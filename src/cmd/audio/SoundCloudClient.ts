import fs from 'fs';
import path from 'path';
import omit from 'lodash.omit';
import fetch, { Response } from 'node-fetch';
import querystring from 'querystring';
import FormData from 'form-data';
import { SoundCloudTrackAttrs, SoundCloudPlaylistAttrs } from './types';

interface Config {
  username: string;
  password: string;
  clientId: string;
  clientSecret: string;
}

export default class SoundCloudClient {
  private token = ``;

  public constructor(private config: Config) {}

  public async getTrack(trackId: number): Promise<null | Record<string, any>> {
    if (!this.token) await this.getToken();
    const res = await fetch(this.endpoint(`tracks/${trackId}?oauth_token=${this.token}`));
    if (res.status === 404) {
      return null;
    }
    if (res.status >= 300) {
      throw new Error(`Error getting track: ${trackId}. ${res.status}/${res.statusText}`);
    }
    return await res.json();
  }

  public async getPlaylist(playlistId: number): Promise<null | Record<string, any>> {
    if (!this.token) await this.getToken();
    const res = await fetch(
      this.endpoint(`playlists/${playlistId}?oauth_token=${this.token}`),
    );
    if (res.status === 404) {
      return null;
    }
    if (res.status >= 300) {
      throw new Error(
        `Error getting track: ${playlistId}. ${res.status}/${res.statusText}`,
      );
    }
    return await res.json();
  }

  public async setPlaylistAttrs(
    playlistId: number,
    playlist: SoundCloudPlaylistAttrs,
  ): Promise<boolean> {
    const body = { playlist: this.playlistData(playlist) };
    const res = await this.sendJson(`playlists/${playlistId}`, body, `PUT`);
    if (res.status >= 300) {
      throw new Error(`Error setting playlist attrs. ${res.status}/${res.statusText}`);
    }
    return true;
  }

  public async setTrackArtwork(trackId: number, imagePath: string): Promise<boolean> {
    if (!this.token) await this.getToken();

    const fd = new FormData();
    fd.append(`oauth_token`, this.token);
    fd.append(`track[artwork_data]`, fs.createReadStream(imagePath));

    const res = await fetch(this.endpoint(`tracks/${trackId}`), {
      method: `put`,
      body: fd,
    });

    if (res.status >= 300) {
      throw new Error(`Error setting track artwork. ${res.status}/${res.statusText}`);
    }
    return true;
  }

  public async setPlaylistArtwork(
    playlistId: number,
    imagePath: string,
  ): Promise<boolean> {
    if (!this.token) await this.getToken();

    const fd = new FormData();
    fd.append(`oauth_token`, this.token);
    fd.append(`playlist[artwork_data]`, fs.createReadStream(imagePath));

    const res = await fetch(this.endpoint(`playlists/${playlistId}`), {
      method: `put`,
      body: fd,
    });

    if (res.status >= 300) {
      throw new Error(`Error setting playlist artwork. ${res.status}/${res.statusText}`);
    }
    return true;
  }

  private playlistData(playlist: SoundCloudPlaylistAttrs): Record<string, any> {
    return {
      tracks: playlist.trackIds.map((id) => ({ id })),
      tag_list: playlist.tags.join(` `),
      ...omit(playlist, [`tags`, `trackIds`]),
    };
  }

  public async createPlaylist(playlist: SoundCloudPlaylistAttrs): Promise<number> {
    const res = await this.sendJson(`playlists`, {
      playlist: this.playlistData(playlist),
    });

    if (res.status >= 300) {
      throw new Error(
        `Error creating soundcloud playlist. ${res.status}/${res.statusText}`,
      );
    }
    const json = await res.json();
    return json.id;
  }

  public async updateTrackAttrs(
    trackId: number,
    attrs: Record<string, string | boolean | null | undefined>,
  ): Promise<Record<string, any>> {
    if (!this.token) await this.getToken();

    const res = await this.sendJson(`tracks/${trackId}`, { track: attrs }, `PUT`);
    if (res.status >= 300) {
      throw new Error(`Error updating track attributes. ${res.status}/${res.statusText}`);
    }
    return await res.json();
  }

  public async replaceTrack(trackId: number, audioPath: string): Promise<boolean> {
    if (!this.token) await this.getToken();

    const fd = new FormData();
    fd.append(`oauth_token`, this.token);
    fd.append(`track[asset_data]`, fs.createReadStream(audioPath));

    const res = await fetch(this.endpoint(`tracks/${trackId}`), {
      method: `put`,
      body: fd,
    });

    if (res.status >= 300) {
      throw new Error(
        `Error replacing soundcloud track. ${res.status}/${res.statusText}`,
      );
    }

    return true;
  }

  public async uploadTrack(
    audioPath: string,
    imagePath: string,
    attrs: SoundCloudTrackAttrs,
  ): Promise<number> {
    if (!this.token) await this.getToken();

    const fd = new FormData();
    fd.append(`oauth_token`, this.token);
    fd.append(`track[title]`, attrs.title);
    fd.append(`track[asset_data]`, fs.createReadStream(audioPath));
    fd.append(`track[artwork_data]`, fs.createReadStream(imagePath));
    fd.append(`track[original_filename]`, path.basename(audioPath));
    fd.append(`track[sharing]`, attrs.sharing);
    fd.append(`track[embeddable_by]`, attrs.embeddable_by);
    fd.append(`track[track_type]`, attrs.track_type);
    fd.append(`track[label_name]`, attrs.label_name);
    fd.append(`track[genre]`, attrs.genre);
    fd.append(`track[commentable]`, String(attrs.commentable));
    fd.append(`track[description]`, attrs.description);
    fd.append(`track[downloadable]`, String(attrs.downloadable));
    if (attrs.tags.length) {
      fd.append(`track[tag_list]`, attrs.tags.join(` `));
    }

    const res = await fetch(this.endpoint(`tracks`), {
      method: `post`,
      body: fd,
    });

    if (res.status >= 300) {
      throw new Error(
        `Error uploading soundcloud track. ${res.status}/${res.statusText}`,
      );
    }
    const json = await res.json();
    return json.id;
  }

  private async sendJson(
    path: string,
    body: Record<string, any>,
    method: 'POST' | 'PUT' = `POST`,
  ): Promise<Response> {
    if (!this.token) await this.getToken();

    const authQuery = querystring.stringify({
      oauth_token: this.token,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    return fetch(this.endpoint(`${path}?${authQuery}`), {
      method,
      headers: { 'Content-Type': `application/json` },
      body: JSON.stringify(body),
    });
  }

  private async getToken(): Promise<void> {
    const cachedTokenPath = `${__dirname}/.soundcloud-token`;
    if (fs.existsSync(cachedTokenPath)) {
      this.token = fs.readFileSync(cachedTokenPath).toString().trim();
      return;
    }

    const res = await this.postForm(`oauth2/token`, {
      grant_type: `password`,
      scope: `non-expiring`,
      username: this.config.username,
      password: this.config.password,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    if (res.status >= 300) {
      throw new Error(
        `Error acquiring soundcloud access token. ${res.status}/${res.statusText}`,
      );
    }
    const json = await res.json();
    this.token = json.access_token;
    fs.writeFileSync(cachedTokenPath, this.token);
  }

  private postForm(path: string, params: Record<string, any>): Promise<Response> {
    return fetch(this.endpoint(path), {
      method: `POST`,
      headers: { 'Content-Type': `application/x-www-form-urlencoded` },
      body: querystring.stringify(params),
    });
  }

  private endpoint(path: string): string {
    return `https://api.soundcloud.com/${path}`;
  }
}

/* eslint-disable */
// @ts-nocheck
import fs from 'fs';
import { google, youtube_v3 } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';
import readline from 'readline';
import creds from './auth.json';

async function main() {
  const auth = new google.auth.OAuth2(
    creds.installed.client_id,
    creds.installed.client_secret,
    creds.installed.redirect_uris[0],
  );

  const TOKEN_PATH = `${__dirname}/token.json`;
  if (fs.existsSync(TOKEN_PATH)) {
    auth.credentials = JSON.parse(fs.readFileSync(TOKEN_PATH, `utf-8`));
  } else {
    auth.credentials = await getNewToken(auth);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(auth.credentials, null, 2));
  }
  google.options({ auth });
  const youtube = google.youtube(`v3`);

  const res = await youtube.videos.list({
    part: [`fileDetails`, `contentDetails`, `id`],
    id: [`H4rl7LiNyrA`],
  });

  uploadVideo(youtube);
}

async function uploadVideo(youtube: youtube_v3.Youtube) {
  const fileName = `/Users/jared/Desktop/fox1.mp4`;
  const fileSize = fs.statSync(fileName).size;
  const res = await youtube.videos.insert(
    {
      // part: 'id,snippet,status',
      part: [`id`, `snippet`, `status`],
      notifySubscribers: false,
      requestBody: {
        snippet: {
          title: `Testing`,
          description: `Testing, 1, 2, 3`,
        },
        status: {
          privacyStatus: `private`,
        },
      },
      media: {
        body: fs.createReadStream(fileName),
      },
    },
    {
      // Use the `onUploadProgress` event from Axios to track the
      // number of bytes uploaded to this point.
      onUploadProgress: (evt) => {
        const progress = (evt.bytesRead / fileSize) * 100;
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0, undefined);
        process.stdout.write(`${Math.round(progress)}% complete`);
      },
    },
  );
  console.log(`\n\n`);
  console.log(res.data);
  return res.data;
}

function getChannel(client: OAuth2Client) {
  var service = google.youtube(`v3`);
  service.channels.list(
    {
      auth: client,
      part: [`snippet`, `contentDetails`, `statistics`],
      id: [`UCqGkjGbBPrwz8QNkDKJ089w`],
      // forUsername: 'GoogleDevelopers',
    },
    function (err, response) {
      if (err) {
        console.log(`The API returned an error: ` + err);
        return;
      }
      var channels = response!.data.items;
      if (channels!.length == 0) {
        console.log(`No channel found.`);
      } else {
        console.log(
          `This channel's ID is %s. Its title is '%s', and ` + `it has %s views.`,
          channels![0].id,
          channels![0].snippet!.title,
          channels![0].statistics!.viewCount,
        );
      }
    },
  );
}

function getNewToken(client: OAuth2Client): Promise<Credentials> {
  const authUrl = client.generateAuthUrl({
    access_type: `offline`,
    scope: [
      `https://www.googleapis.com/auth/youtube.upload`,
      `https://www.googleapis.com/auth/youtube`,
    ],
  });

  console.log(`Authorize this app by visiting this url: `, authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((res, rej) => {
    rl.question(`Enter the code from that page here: `, function (code) {
      rl.close();
      client.getToken(code, function (err, token) {
        if (err) {
          console.log(`Error while trying to retrieve access token`, err);
          rej(err);
          return;
        }

        if (!token) {
          rej(new Error(`No token!`));
          return;
        }

        res(token);

        // client.credentials = token;
        // storeToken(token);
        // callback(client);
      });
    });
  });
}

main();

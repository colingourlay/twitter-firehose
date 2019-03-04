const path = require('path');
const makeDir = require('make-dir');
const Twit = require('twit');
const writeJsonFile = require('write-json-file');
const { generateIdRange, getComponents } = require('./snowflake');

if (require('dotenv').config().error) {
  console.error(`🚨  Couldn't load .env`);
  process.exit();
}

const CONFIG = {
  twitter: {
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    // app_only_auth: true
    access_token: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
  },
  time: {
    msToFetch: process.env.MS_TO_FETCH
  }
};

const T = new Twit(CONFIG.twitter);

const chunks = (arr, size) =>
  Array(Math.ceil(arr.length / size))
    .fill()
    .map((_, index) => index * size)
    .map(begin => arr.slice(begin, begin + size));

const processIds = async ids => {
  const groups = chunks(ids, 100);

  const resultsForGroups = await Promise.all(
    groups.map(ids => T.get('statuses/lookup', { id: ids.join(','), trim_user: true }))
  );

  return resultsForGroups.reduce((memo, { data, resp }) => {
    return memo.concat(data ? data : []);
  }, []);
};

(async () => {
  const to = Date.now();
  const from = to - CONFIG.time.msToFetch + 1;
  const ids = generateIdRange(from, to);
  const tweets = await processIds(ids);
  const outputFilename = `${new Date(from).toISOString()}_${new Date(to).toISOString()}.json`;
  const outputPath = await makeDir(path.join(__dirname, 'output'));

  await writeJsonFile(
    path.join(outputPath, outputFilename),
    tweets.map(({ id_str, text, user }) => ({
      id: id_str,
      // snowflake: (() => {
      //   const { creationTime, dataCenterId, machineId, sequenceId } = getComponents(id_str);
      //   return [creationTime, dataCenterId, machineId, sequenceId].join('|');
      // })(),
      userId: user.id_str,
      text
    }))
  );

  console.log(
    `Wrote ${tweets.length} tweets (from ${ids.length} predicted IDs) posted in the last ${
      CONFIG.time.msToFetch
    }ms to "${outputFilename}"`
  );
})();

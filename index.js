const assert = require('assert');
const path = require('path');
const loadJsonFile = require('load-json-file');
const makeDir = require('make-dir');
const tokenDealer = require('token-dealer');
const Twit = require('twit');
const writeJsonFile = require('write-json-file');
const { generateIdRange, getComponents } = require('./snowflake');

const delay = ms => new Promise(done => setTimeout(done, ms));

const chunks = (arr, size) =>
  Array(Math.ceil(arr.length / size))
    .fill()
    .map((_, index) => index * size)
    .map(begin => arr.slice(begin, begin + size));

const agents = [];

const _registerAgent = agent => {
  agents.push(agent);

  return agents.length - 1;
};

const _getTweets = (ids, token, exhaust) => {
  const agent = agents[token];
  const T = new Twit(agent);

  return T.get('statuses/lookup', { id: ids.join(','), include_entities: false, trim_user: true })
    .then(async ({ data, resp }) => {
      if (+resp.headers['x-rate-limit-remaining'] === 0) {
        exhaust(+resp.headers['x-rate-limit-reset'], false);
      }

      // console.log(`Got ${data.length}/${ids.length} tweets`);

      await delay(1000);

      return data.map(tweet => Object.assign(tweet, { agent }));
    })
    .catch(err => {
      if (+err.statusCode === 429) {
        exhaust(15 * 60 * 1000, true);
      }

      return [];
    });
};

(async () => {
  let config;

  try {
    config = await loadJsonFile(path.join(__dirname, 'config.json'));
    assert(typeof config.time === 'object');
    assert(typeof config.time.recentMS === 'number');
    assert(Array.isArray(config.apps));
    config.apps.forEach(app => {
      assert(typeof app === 'object');
      assert(typeof app.consumer_key === 'string');
      assert(typeof app.consumer_secret === 'string');
      if (Array.isArray(app.users)) {
        app.users.forEach(user => {
          assert(typeof user === 'object');
          assert(typeof user.access_token === 'string');
          assert(typeof user.access_token_secret === 'string');
        });
      }
    });
  } catch (err) {
    console.error(`🚨  Couldn't load config`);
    console.error(err);
    process.exit();
  }

  let capacity = 0;

  tokens = config.apps
    .reduce((memo, app) => {
      const { consumer_key, consumer_secret, users } = app;

      memo.push({ consumer_key, consumer_secret, app_only_auth: true });
      capacity += 300;

      if (users) {
        users.forEach(user => {
          memo.push(Object.assign({ consumer_key, consumer_secret }, user));
          capacity += 900;
        });
      }

      return memo;
    }, [])
    .map(_registerAgent);

  const to = Date.now();
  const from = to - config.time.recentMS + 1;
  const ids = generateIdRange(from, to);
  const groups = chunks(ids, 100);

  // const windowSize = 15 * 60 * 1000;
  // const estimatedTime = (groups.length / capacity) * windowSize;
  // console.log({ numGroups: groups.length, capacity, windowSize, estimatedTime });
  // console.log(`This should take about ${Math.ceil(estimatedTime / 1000)} seconds...`);

  const tweets = await Promise.all(
    groups.map(ids =>
      tokenDealer(tokens, (token, exhaust) => _getTweets(ids, token, exhaust), {
        wait: true
      })
    )
  )
    .then(async tweetsGroups => {
      return tweetsGroups.reduce((memo, tweets) => memo.concat(tweets), []);
    })
    .catch(err => {
      /* TODO */
    });

  // console.log(`Received ${tweets.length} tweets`);

  const outputFilename = `${new Date(from).toISOString()}_${new Date(to).toISOString()}.json`;
  const outputPath = await makeDir(path.join(__dirname, 'output'));
  const tweetsData = tweets.map(
    ({
      id_str,
      text,
      truncated,
      user,
      retweet_count,
      favorite_count,
      retweeted_status,
      quoted_status_id,
      in_reply_to_status_id_str
    }) => ({
      id: id_str,
      snowflake: (() => {
        const { creationTime, dataCenterId, machineId, sequenceId } = getComponents(id_str);
        return [creationTime, dataCenterId, machineId, sequenceId].join('|');
      })(),
      userId: user.id_str,
      text: truncated || text,
      retweets: retweet_count,
      likes: favorite_count,
      quotedId: quoted_status_id || null,
      retweetedId: retweeted_status ? retweeted_status.id_str : null,
      repliedId: in_reply_to_status_id_str || null
    })
    // .filter(x => !x.quotedId) // No quotes
    // .filter(x => !x.retweetedId) // No retweets (native)
    // .filter(x => !x.repliedId) // No replies
  );

  console.log(`Saved ${tweetsData.length} tweets to ${outputFilename}`);

  await writeJsonFile(path.join(outputPath, outputFilename), tweetsData);
})();

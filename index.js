const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { distanceInWordsStrict } = require('date-fns');
const csv = require('fast-csv');
const hash = require('object-hash');
const makeDir = require('make-dir');
const ProgressBar = require('progress');
const tokenDealer = require('token-dealer');
const Twit = require('twit');
const { generateId, getComponents } = require('./snowflake');

const MAX_CONCURRENT_TASKS = 500;
const SEQUENCE_IDS = [0, 1, 2, 6, 5, 3, 7, 4, 8, 10];
const WORKER_IDS = [375, 382, 361, 372, 364, 381, 376, 365, 363, 362, 350, 325, 335, 333, 342, 326, 327, 336, 347, 332];

let config;

const checkConfigStructure = config => {
  assert(typeof config.time === 'object');
  assert(typeof config.time.recentMS === 'number');
  assert(typeof config.tweets === 'object');
  assert(typeof config.tweets.exclude === 'function');
  assert(typeof config.tweets.transform === 'function');
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
};

try {
  config = require('./config');
  checkConfigStructure(config);
} catch (err) {
  console.error(`🚨  Couldn't load config`);
  console.error(err);
  process.exit(1);
}

const wait = time => new Promise(resolve => setTimeout(resolve, time));

const agents = {};

const _registerAgent = agent => {
  const token = hash(agent);

  agents[token] = agent;

  return token;
};

const _tweetTransform = ({
  id_str,
  text,
  truncated,
  user,
  retweet_count,
  favorite_count,
  retweeted_status,
  quoted_status_id,
  in_reply_to_status_id_str,
  lang
}) => ({
  id: id_str,
  snowflake: (() => {
    const { creationTime, dataCenterId, machineId, sequenceId } = getComponents(id_str);
    return [creationTime, dataCenterId, machineId, sequenceId].join('|');
  })(),
  userId: user.id_str,
  retweets: retweet_count,
  likes: favorite_count,
  quotedId: quoted_status_id || null,
  retweetedId: retweeted_status ? retweeted_status.id_str : null,
  repliedId: in_reply_to_status_id_str || null,
  lang,
  text: truncated && typeof truncated !== 'boolean' ? truncated : text
});

let total = 0;

const _getTweets = (ids, csvStream, updateBar, token, exhaust) => {
  const agent = agents[token];
  const T = new Twit(agent);

  return T.get('statuses/lookup', { id: ids.join(','), include_entities: false, trim_user: true })
    .then(async ({ data, resp }) => {
      if (+resp.headers['x-rate-limit-remaining'] === 0) {
        exhaust(+resp.headers['x-rate-limit-reset'], true);
      }

      total += data.length;

      data
        .map(_tweetTransform)
        .filter(config.tweets.exclude)
        .map(config.tweets.transform)
        .forEach(tweet => csvStream.write(tweet));

      updateBar(1);
    })
    .catch(err => {
      if (+err.statusCode === 429) {
        exhaust(15 * 60 * 1000, true);
      }
    });
};

let estimatedRequestsPerWindow = 0;

const _registerAgents = apps =>
  apps
    .reduce((memo, app) => {
      const { consumer_key, consumer_secret, users, skipAppOnly } = app;

      if (!skipAppOnly) {
        memo.push({ consumer_key, consumer_secret, app_only_auth: true });
        estimatedRequestsPerWindow += 300;
      }

      if (users) {
        users.forEach(user => {
          memo.push(Object.assign({ consumer_key, consumer_secret }, user));
          estimatedRequestsPerWindow += 900;
        });
      }

      return memo;
    }, [])
    .map(_registerAgent);

const _generateAndFeedIDs = async (from, to, onGroup) =>
  new Promise(async resolve => {
    if (typeof from !== 'number') {
      throw new Error(`'from' must be a Number`);
    }

    let group = [];
    let groupCount = 0;

    for (let creationTime = from; creationTime <= to; creationTime++) {
      for (workerId of WORKER_IDS) {
        for (sequenceId of SEQUENCE_IDS) {
          group.push(generateId(String(creationTime), String(workerId), String(sequenceId)));

          if (group.length === 100) {
            await onGroup(group); // Allow pausing
            group = [];
            ++groupCount;
          }
        }
      }
    }

    resolve();
  });

(async () => {
  const tokens = _registerAgents(config.apps);
  const to = Date.now();
  const from = to - config.time.recentMS;
  const numTweetsToGenerate = (to - from) * WORKER_IDS.length * SEQUENCE_IDS.length;

  const outputFilename = `${from}_${to}.csv`;
  const outputPath = await makeDir(path.join(__dirname, 'output'));
  const csvStream = csv.createWriteStream({ headers: true });

  csvStream.pipe(fs.createWriteStream(path.join(outputPath, outputFilename), { flags: 'a' }));

  console.log(`
* We have to check ${numTweetsToGenerate} IDs that could have been generated in ${
    config.time.recentMS <= 1000 ? `${config.time.recentMS}ms` : distanceInWordsStrict(from, to)
  }
* The ${tokens.length} tokens provided can make up to ${estimatedRequestsPerWindow} API calls every 15 minutes 
* Each API call can check 100 IDs, so this process can take between ${Math.floor(
    numTweetsToGenerate / 100 / estimatedRequestsPerWindow
  ) * 15} and ${Math.ceil(numTweetsToGenerate / 100 / estimatedRequestsPerWindow) * 15} minutes
`);

  const bar = new ProgressBar('Fetching tweets [:bar] :percent  ⏳ :elapseds  ⌛️ :etas  🐦  :atk/:ttk', {
    complete: '=',
    incomplete: ' ',
    width: 20,
    total: Math.ceil(numTweetsToGenerate / 100)
  });

  const updateBar = increment => {
    const usage = tokenDealer.getTokensUsage(tokens);
    const atk = Object.keys(usage).filter(x => !usage[x].exhausted).length;

    bar.tick(increment, {
      atk,
      ttk: tokens.length
    });
  };

  const barRefreshInterval = setInterval(() => {
    if (!bar.complete) {
      updateBar(0);
    }
  }, 500);

  const tasks = [];
  let isWindingDown = false;

  await _generateAndFeedIDs(from, to, async group => {
    // (1.) Pushback
    while (tasks.length >= MAX_CONCURRENT_TASKS) {
      await wait(250);
    }

    // 2. Starting
    const task = tokenDealer(tokens, (token, exhaust) => _getTweets(group, csvStream, updateBar, token, exhaust), {
      wait: true
    }).then(() => {
      // 4. Clearing
      if (!isWindingDown) {
        return tasks.splice(tasks.indexOf(task), 1);
      }
    });

    // 3. Registering
    tasks.push(task);
  });

  // Wind down
  isWindingDown = true;
  await Promise.all(tasks);

  clearInterval(barRefreshInterval);
  csvStream.end();
  process.exit();
})();

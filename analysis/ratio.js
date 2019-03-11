const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const csvParser = require('csv-parser');
const makeDir = require('make-dir');
const { getCreationTime } = require('twitter-snowflake-utils');

const inputPath = path.join(process.cwd(), process.argv[process.argv.indexOf(__filename) + 1]);
const minutes = {};

let originalId;
let totalQuotes = 0;
let totalReplies = 0;
let totalRetweets = 0;

fs.createReadStream(inputPath)
  .pipe(csvParser())
  .on('data', tweet => {
    const { id, isRetweet, quotedId, repliedId } = tweet;

    if (!originalId) {
      originalId = id;

      return;
    }

    const creationMinute = new Date(+getCreationTime(id));

    creationMinute.setSeconds(0, 0);

    if (!minutes[+creationMinute]) {
      minutes[+creationMinute] = {
        creationMinute: creationMinute.toISOString(),
        quotes: 0,
        replies: 0,
        retweets: 0,
        quotesCumulative: 0,
        repliesCumulative: 0,
        retweetsCumulative: 0
      };
    }

    const data = minutes[+creationMinute];

    if (quotedId) {
      totalQuotes++;
      data.quotes++;
    }

    if (isRetweet) {
      totalRetweets++;
      data.retweets++;
    }

    if (repliedId.length) {
      totalReplies++;
      data.replies++;
    }

    data.quotesCumulative = totalQuotes;
    data.retweetsCumulative = totalRetweets;
    data.repliesCumulative = totalReplies;
  })
  .on('end', async () => {
    const creationMinutes = Object.keys(minutes);
    const outputFilename = `ratio_${originalId}_${creationMinutes[0]}_${
      creationMinutes[creationMinutes.length - 1]
    }.csv`;
    const outputPath = await makeDir(path.join(__dirname, 'output'));
    const csvStream = csv.createWriteStream({ headers: true });

    csvStream.pipe(fs.createWriteStream(path.join(outputPath, outputFilename), { flags: 'a' }));
    creationMinutes.forEach(creationMinute => csvStream.write(minutes[creationMinute]));
    csvStream.end();
  });

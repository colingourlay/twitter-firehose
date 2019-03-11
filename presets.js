const { getCreationTime } = require('twitter-snowflake-utils');

const REPLY_RECIPIENTS_PATTERN = /^(?:@[\w_]+\s)+/;

/*
"reactions" stores:
* The originating tweet
* Retweets
* Quotes
* Replies tree (replies of replies)
*/
module.exports.reactions = (screenName, id, duration, offset = 0) => {
  const from = +new Date(+getCreationTime(id) + offset);

  const idsToCountRepliesOf = [id]; // do we need to manage memory of this using a trie?

  return {
    time: {
      from,
      to: duration + from
    },
    tweets: {
      filter: x =>
        x.id === id || x.retweetedId === id || x.quotedId === id || idsToCountRepliesOf.indexOf(x.repliedId) > -1,
      map: x => {
        x.isRetweet = null;

        if (x.retweetedId) {
          x.isRetweet = 1;
          x.likes = null;
          x.retweets = null;
          x.text = null;
        }

        if (x.repliedId) {
          if (idsToCountRepliesOf.indexOf(x.id) === -1) {
            idsToCountRepliesOf.push(x.id);
          }

          x.text = x.text.replace(REPLY_RECIPIENTS_PATTERN, '');
        }

        delete x.lang;
        delete x.retweetedId;
        delete x.snowflake;

        return x;
      }
    }
  };
};

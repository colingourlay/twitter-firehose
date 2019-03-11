const { getCreationTime } = require('twitter-snowflake-utils');

module.exports.reactions = (screenName, id, duration, offset = 0) => {
  const from = +new Date(+getCreationTime(id) + offset);

  return {
    time: {
      from,
      to: duration + from
    },
    tweets: {
      filter: x => x.id === id || x.retweetedId === id || x.quotedId === id || x.repliedId === id,
      map: x => {
        x.isRetweet = null;

        if (x.retweetedId) {
          x.isRetweet = 1;
          x.likes = null;
          x.retweets = null;
          x.text = null;
        }

        if (x.repliedId && x.text.toLowerCase().indexOf(screenName.toLowerCase()) === 1) {
          x.text = x.text.slice(screen_name.length + 2);
        }

        delete x.lang;
        delete x.retweetedId;
        delete x.snowflake;

        return x;
      }
    }
  };
};

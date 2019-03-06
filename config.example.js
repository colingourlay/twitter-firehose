module.exports = {
  time: {
    recentMS: 100
  },
  tweets: {
    filter: x => true,
    map: x => x
  },
  apps: [
    {
      consumer_key: '',
      consumer_secret: '',
      users: [
        {
          access_token: '',
          access_token_secret: ''
        }
      ]
    }
  ]
};

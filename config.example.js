module.exports = {
  time: {
    recentMS: 100
  },
  tweets: {
    exclude: x => x,
    transform: x => x
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

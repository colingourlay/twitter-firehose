module.exports = {
  time: {
    from: Date.now() - 1000,
    to: Date.now()
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

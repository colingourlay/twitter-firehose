# twitter-firehose

Experimenting with pulling time periods (in the region of 100s of ms) of tweets, using [Jason Baungartner's tweet ID prediction efforts](https://docs.google.com/document/d/1xVrPoNutyqTdQ04DXBEZW4ZW4A5RAQW2he7qIpTmG-M/)

## Usage

1. Copy `example.env` to `.env` and add your Twitter API keys.
2. `npm install` dependencies
3. `npm start` to run
4. Check `output` directory for pulled tweets

## TODO

- API key cycling & rate-limit delays based on API response headers, to grab larger periods
- More config options, to look at any period, rather than last 𝑥ms

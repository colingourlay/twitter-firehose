# twitter-firehose

Experimenting with pulling time periods (in the region of 100s of ms) of tweets, using [Jason Baumgartner's tweet ID prediction efforts](https://docs.google.com/document/d/1xVrPoNutyqTdQ04DXBEZW4ZW4A5RAQW2he7qIpTmG-M/)

## Usage

1. Copy `config.example.json` to `config.json`
2. Add your Twitter API keys (multiple apps & users accepted)
3. `npm install` dependencies
4. `npm start` to run
5. Check `output` directory for pulled tweets

## Example output

```sh
$ node index.js

Wrote 343 tweets (from 19800 predicted IDs) posted in the last 100ms to
"2019-03-04T01:52:10.666Z_2019-03-04T01:52:10.765Z.json"
```

In `./output/2019-03-04T01:52:10.666Z_2019-03-04T01:52:10.765Z.json`:

```json
[
  {
    "id": "1102386219227508736",
    "userId": "2901630699",
    "text": "@imlactoast Exactly what I needed to see, thanks boo😇"
  },
  …
]
```

## TODO

- More config options, to look at any period, rather than most recent 𝑥ms

# twitter-firehose

Experimenting with pulling time periods (in the region of 100s of ms) of tweets, using [Jason Baumgartner's tweet ID prediction efforts](https://docs.google.com/document/d/1xVrPoNutyqTdQ04DXBEZW4ZW4A5RAQW2he7qIpTmG-M/)

## Usage

1. Copy `config.example.json` to `config.json`
2. Add your Twitter API keys (multiple apps & users accepted)
3. `npm install` dependencies
4. `npm start` to run
5. Check `output` directory for pulled tweets

## Example output

Assuming you have 49 API keys in your config, and set the time period to 1 minute...

```
$ node index.js

* We have to check 12000000 IDs that could have been generated in 1 minute
* The 49 tokens provided can make up to 30300 API calls every 15 minutes
* Each API call can check 100 IDs, so this process can take between 45 and 60 minutes

Fetching tweets [                    ] 0%  ⏳ 0.0s  ⌛️ 0.0s  🐦 49/49
```

The progress bar shows:

- ⏳ Time elapsed
- ⌛️ Estimated time remaining
- 🐦 Unexpired tokens / Total tokens

Once the process completes, `./output/1551854632523_1551854632524.csv` will contain:

```csv
id,snowflake,userId,retweets,likes,quotedId,retweetedId,repliedId,text
1103184403071684608,1551854632524|11|13|0,939465324470169600,0,0,,,1102943432400687107,en,@johnlewis I thought it was pancake day every day in America?
…
```

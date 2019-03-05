# twitter-firehose

Experimenting with pulling time periods (in the region of 100s of ms) of tweets, using [Jason Baumgartner's tweet ID prediction efforts](https://docs.google.com/document/d/1xVrPoNutyqTdQ04DXBEZW4ZW4A5RAQW2he7qIpTmG-M/)

## Usage

1. Copy `config.example.json` to `config.json`
2. Add your Twitter API keys (multiple apps & users accepted)
3. `npm install` dependencies
4. `npm start` to run
5. Check `output` directory for pulled tweets

## Example output

```
$ node index.js

Checking 11999800 potential IDs to fetch 60000ms of tweets...
[==                                      ] 5% (ETA: 514.4s)
```

In `./output/1551786669998_1551786729997.csv`:

```csv
id,snowflake,userId,retweets,likes,quotedId,retweetedId,repliedId,text
1102792087236308992,1551761097140|10|15|0,606804473,0,0,,,,"Necesito amigos, no me aguanto un día mas encerrada en mi casa😩"
1102792087030788097,1551761097091|10|15|1,811436701377699840,0,0,,,,i just wanna know why both of my thighs are bruised
1102792087030792192,1551761097091|10|16|0,1001499676518924288,0,0,,,,何をどうやったらこの画像が生まれて誤植されるねん()
1102792087446028288,1551761097190|10|16|0,525101830,0,0,,,,#李旺阳#  现在有些人给予死后的李旺阳以很高评价，似乎是期待出现更多的“李旺阳”，
1102792087269863424,1551761097148|10|15|0,912993238893551616,0,0,,,,俺は今あああ猛烈にいいい勉強したい気分だどおおおおおおん
```

## TODO

- More config options, to look at any period, rather than most recent 𝑥ms

const express = require('express');
const cors = require('cors');
const monk = require('monk');
const Filter = require('bad-words');
const rateLimit = require('express-rate-limit');

const app = express();

// const db = monk(process.env.MONGO_URI || 'localhost/meower');
const db = monk(process.env.MONGO_URI || 'localhost/SMfortweets');
const tweets = db.get('tweets');
const filter = new Filter();

app.enable('trust proxy');

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Tweeterr'
  });
});

app.get('/tweets', (req, res, next) => {
  mews
    .find()
    .then(tweets => {
      res.json(tweets);
    }).catch(next);
});

app.get('/v2/tweets', (req, res, next) => {
  // let skip = Number(req.query.skip) || 0;
  // let limit = Number(req.query.limit) || 10;
  let { skip = 0, limit = 5, sort = 'desc' } = req.query;
  skip = parseInt(skip) || 0;
  limit = parseInt(limit) || 5;

  skip = skip < 0 ? 0 : skip;
  limit = Math.min(50, Math.max(1, limit));

  Promise.all([
    tweets
      .count(),
    tweets
      .find({}, {
        skip,
        limit,
        sort: {
          created: sort === 'desc' ? -1 : 1
        }
      })
  ])
    .then(([ total, tweets ]) => {
      res.json({
        tweets,
        meta: {
          total,
          skip,
          limit,
          has_more: total - (skip + limit) > 0,
        }
      });
    }).catch(next);
});

function isValidTweet(tweets) {
  return tweets.name && tweets.name.toString().trim() !== '' && tweets.name.toString().trim().length <= 50 &&
    tweets.content && tweets.content.toString().trim() !== '' && tweets.content.toString().trim().length <= 140;
}

app.use(rateLimit({
  windowMs: 30 * 1000, // 30 seconds
  max: 1
}));

const createTweet = (req, res, next) => {
  if (isValidTweet(req.body)) {
    const tweets = {
      name: filter.clean(req.body.name.toString().trim()),
      content: filter.clean(req.body.content.toString().trim()),
      created: new Date()
    };

    tweets
      .insert(tweets)
      .then(createdTweets => {
        res.json(createdTweets);
      }).catch(next);
  } else {
    res.status(422);
    res.json({
      message: 'Hey! Name and Content are required! Name cannot be longer than 50 characters. Content cannot be longer than 140 characters.'
    });
  }
};

app.post('/tweets', createTweet);
app.post('/v2/tweets', createTweet);

app.use((error, req, res, next) => {
  res.status(500);
  res.json({
    message: error.message
  });
});

app.listen(5000, () => {
  console.log('Listening on http://localhost:5000');
});

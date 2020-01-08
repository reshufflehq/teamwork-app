import fetch from 'node-fetch';

const getTweetsUrl = 'https://api.twitter.com/1.1/statuses/user_timeline.json';

const makeUrl = (handle, count, hideReplies) => {
  const params = [
    `screen_name=${handle}`,
    'tweet_mode=extended',
    `count=${count || 8}`,
    `exclude_replies=${hideReplies ? 'true' : 'false'}`,
  ];
  const queryString = params.join('&');
  return `${getTweetsUrl}?${queryString}`;
}

export async function getTweets(handle, twitterToken) {
  const fetchUrl = makeUrl(handle, 10, true);
  const fetchOptions = {
    method: 'get',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${twitterToken}`,
    },
  };
  const response = await fetch(fetchUrl, fetchOptions);
  return await response.json();
}

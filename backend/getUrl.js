
const { NODE_ENV } = process.env;
const isProd = NODE_ENV === 'prod' || NODE_ENV === 'production';

const localUrl = process.env.LOCAL_URL;
const remoteUrl = `https://${process.env.RESHUFFLE_APPLICATION_DOMAINS}`;

export const getUrl = () => {
  return isProd ? remoteUrl : localUrl
};

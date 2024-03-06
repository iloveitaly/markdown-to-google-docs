import { findOrCreateDoc, hasOpenComments, updateHtml } from './google';
import { authenticate, getClient, getNewToken, hasValidToken } from './auth';

export {
  hasOpenComments, updateHtml, findOrCreateDoc,
  // TODO this auth stuff seems messy
  getClient, hasValidToken, getNewToken, authenticate
};

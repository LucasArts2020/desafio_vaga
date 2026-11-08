import { createOpenSeaHandler } from '../server/opensea.ts'

export default {
  fetch: createOpenSeaHandler({
    apiKey: process.env.OPENSEA_API_KEY,
    collection: process.env.OPENSEA_COLLECTION,
  }),
}

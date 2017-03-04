// TODO: clean this up

const crypto = require('crypto')
const fetch = require('node-fetch')
const fs = require('fs')
const bz2 = require('unbzip2-stream')
const path = require('path')
const progress = require('progress-stream')
const filesize = require('filesize')

const baseUrl = 'https://www.fuzzwork.co.uk/dump'
const dbFilename = 'sqlite-latest.sqlite.bz2'
const decompressedDbFilename = path.basename(dbFilename, '.bz2')
const localDbHashPath = './db-hash'

const packageInfo = require('./package.json')
const userAgent = `${packageInfo.name} v${packageInfo.version}`
const timeout = 2000

/**
 * Create a Promise that resolves when a stream ends and rejects when an error occurs
 * @param {WritableStream|ReadableStream} stream
 * @returns {Promise}
 */
const whenStreamDone = (stream) => new Promise((resolve, reject) => {
  stream.on('end', resolve)
  stream.on('finish', resolve)
  stream.on('error', reject)
})

/**
 * Perform an HTTP request
 * @param {String} url
 * @returns {Promise}
 */
const request = (url) => fetch(url, {
  headers: {
    'User-Agent': userAgent
  },
  timeout
})


/**
 * Get the MD5 hash of a remote file
 * @param {String} filename
 * @returns {Promise<String>} - The hash of the file
 */
const remoteMd5 = async (filename) => {
  const res = await request(`${baseUrl}/${filename}.md5`)

  if (!res.ok) throw new Error(`Could not get remote MD5, ${res.status}: ${res.statusText}`)

  const text = await res.text()
  return text.slice(0, text.indexOf(' '))
}


// /**
//  * Get the MD5 hash of a file
//  * @param {String} filepath - The path to the file
//  * @returns {Promise<String>} - The hash of the file
//  */
// const fileMd5 = (filepath) => new Promise((resolve, reject) => {
//   const hash = crypto.createHash('md5')
//   const stream = fs.createReadStream(filepath)

//   stream.on('error', reject)
//   stream.on('data', (data) => hash.update(data))
//   stream.on('end', () => {
//     resolve(hash.digest('hex'))
//   })
// })

// /**
//  * Check whether there is an update available for a file
//  * @param {String} filepath - The path of the file to check
//  * @returns {Boolean}
//  */
// const fileUpdateAvailable = async (filepath) => {
//   let localHash;
//   try {
//     localHash = await fileMd5(filepath)
//   } catch (error) {
//     if (error.code !== 'ENOENT') throw error
//     localHash = 'NOT_FOUND'
//   }

//   const latestHash = await remoteMd5(path.basename(filepath))

//   return localHash !== latestHash
// }

const getLocalDbHash = () => {
  try {
    return fs.readFileSync(localDbHashPath, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

const setLocalDbHash = (hash) => {
  fs.writeFileSync(localDbHashPath, hash, { encoding: 'utf8' })
}

const checkForDbUpdates = async () => {
  const localHash = getLocalDbHash()
  const latestHash = await remoteMd5(dbFilename)

  return {
    update: localHash !== latestHash,
    latestHash
  }
}

const downloadDb = async (url, filepath) => {
  const res = await request(url)

  const prog = progress({
    time: 1000
  })

  prog.on('progress', (p) => {
    console.log(`Progress: ${filesize(p.transferred)}/?? @ ${filesize(p.speed)}/s`)
  })

  const stream = res.body.pipe(bz2()).pipe(prog).pipe(fs.createWriteStream(filepath))

  stream.on('finish', () => console.log('Download complete'))
  stream.on('error', (error) => console.log('Download error', error))

  return await whenStreamDone(stream)
}

const updateDbIfAvailable = async () => {
  const checkResults = await checkForDbUpdates()

  if (!checkResults.update) {
    console.log('Database is already at the latest version')
    return
  }

  console.log('Database update available')
  console.log('Deleting old database')
  fs.unlinkSync(`./${decompressedDbFilename}`)
  console.log('Old database deleted')
  console.log('Downloading new database')
  await downloadDb(`${baseUrl}/${dbFilename}`, `./${decompressedDbFilename}`)
  console.log('Database updated')

  setLocalDbHash(checkResults.latestHash)
}

updateDbIfAvailable()

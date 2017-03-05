const fs = require('mz/fs')
const R = require('ramda')
const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: './sqlite-latest.sqlite'
  },
  useNullAsDefault: true
})

const compareCoord = (coord, point) => ({
  min: R.min(point[coord]),
  max: R.max(point[coord])
})

const getBounds = R.reduce((acc, point) => R.evolve({
    x: compareCoord('x', point),
    y: compareCoord('y', point),
    z: compareCoord('z', point)
  }, acc),
  {
    x: {
      min: Number.POSITIVE_INFINITY,
      max: Number.NEGATIVE_INFINITY
    },
    y: {
      min: Number.POSITIVE_INFINITY,
      max: Number.NEGATIVE_INFINITY
    },
    z: {
      min: Number.POSITIVE_INFINITY,
      max: Number.NEGATIVE_INFINITY
    }
  })

const normalizeCoord = (coord, bounds) => (value) => ((value - bounds[coord].min) / bounds[coord].range)

const normalizePoints = (bounds, points) => {
  bounds.x.range = bounds.x.max - bounds.x.min
  bounds.y.range = bounds.y.max - bounds.y.min
  bounds.z.range = bounds.z.max - bounds.z.min

  return R.map(R.evolve({
    x: normalizeCoord('x', bounds),
    y: normalizeCoord('y', bounds),
    z: normalizeCoord('z', bounds)
  }), points)
}

const getRegions = () => knex('mapRegions')
  .select(['regionID', 'regionName'])
  .reduce((acc, region) => {
    acc[region.regionID] = region.regionName
    return acc
  }, {})

const getJumps = () => knex('mapSolarSystemJumps')
  .select(['fromSolarSystemID', 'toSolarSystemID'])
  .map((jump) => {
    return {
      from: jump.fromSolarSystemID,
      to: jump.toSolarSystemID
    }
  })

const getSolarSystems = (regions) => knex('mapSolarSystems')
  .select([
    'regionID',
    'security',
    'solarSystemID',
    'solarSystemName',
    'x', 'y', 'z'
  ])
  // Skip wormhole systems
  .where('solarSystemID', '<', 31000000)
  // Grab the info we want
  .map((solarSystem) => {
    return {
      name: solarSystem.solarSystemName,
      id: solarSystem.solarSystemID,
      security: solarSystem.security,
      region: regions[solarSystem.regionID],
      x: solarSystem.x,
      y: solarSystem.y,
      z: solarSystem.z
    }
  })
  // Normalize coordinates
  .then(R.converge(normalizePoints, [getBounds, R.identity]))

const generateJson = async (outputPath, indentation = 2) => {
  const regions = await getRegions()
  const solarSystems = await getSolarSystems(regions)
  const jumps = await getJumps()

  return await fs.writeFile(
    outputPath,
    JSON.stringify(
      {
        // regions,
        solarSystems,
        jumps
      },
      null,
      indentation
    ),
    { encoding: 'utf8' }
  )
}

generateJson('./dist/universe-pretty.json').then(() => console.log('Done!'))

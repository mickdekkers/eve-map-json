const fs = require('mz/fs')
const R = require('ramda')
const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: './sqlite-latest.sqlite'
  },
  useNullAsDefault: true
})

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

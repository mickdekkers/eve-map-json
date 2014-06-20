# Start the timer
console.time 'doneAfter'
# Import FileSystem
fs = require 'fs'

# Read the JSON files (I used SQLiteStudio to export these from fuzzwork's SQLite conversions)
mapSolarSystems = JSON.parse fs.readFileSync './mapSolarSystems.json', 'utf-8'
mapSolarSystemJumps = JSON.parse fs.readFileSync './mapSolarSystemJumps.json', 'utf-8'
mapRegions = JSON.parse fs.readFileSync './mapRegions.json', 'utf-8'

# Create temporary lookup object for faster parsing later on
regions = {}
for mapRegion in mapRegions
  regions[mapRegion.regionID] = mapRegion.regionName
# Define the output object
output = (
  nodes: {}
  edges: []
)


# Process nodes
for node in mapSolarSystems
  # Grab the data we want
  newNode = {}
  newNode.name = node.solarSystemName
  newNode.security = node.security
  newNode.region = regions[node.regionID]
  newNode.x = node.x
  newNode.y = node.y
  newNode.z = node.z
  # Add it to the nodes object
  output.nodes[node.solarSystemID] = newNode


# Process edges
for edge in mapSolarSystemJumps
  # Grab the data we want
  newEdge = {}
  newEdge.from = edge.fromSolarSystemID
  newEdge.to = edge.toSolarSystemID
  # Add it to the edges array
  output.edges.push newEdge


# Normalize coordinates
coords = (
  x: (
    max: Number.NEGATIVE_INFINITY
    min: Number.POSITIVE_INFINITY
  )
  y: (
    max: Number.NEGATIVE_INFINITY
    min: Number.POSITIVE_INFINITY
  )
  z: (
    max: Number.NEGATIVE_INFINITY
    min: Number.POSITIVE_INFINITY
  )
)
# Find highest and lowest values for each axis
for own nodeRef of output.nodes
  node = output.nodes[nodeRef]
  if node.x < coords.x.min then coords.x.min = node.x
  if node.x > coords.x.max then coords.x.max = node.x
  if node.y < coords.y.min then coords.y.min = node.y
  if node.y > coords.y.max then coords.y.max = node.y
  if node.z < coords.z.min then coords.z.min = node.z
  if node.z > coords.z.max then coords.z.max = node.z
# Store the absolute min values
coords.x.minAbs = Math.abs(coords.x.min)
coords.y.minAbs = Math.abs(coords.y.min)
coords.z.minAbs = Math.abs(coords.z.min)
# Offset all the coordinates
for own nodeRef of output.nodes
  node = output.nodes[nodeRef]
  node.x += coords.x.minAbs
  node.y += coords.y.minAbs
  node.z += coords.z.minAbs
# Also offset the max values
coords.x.max += coords.x.minAbs
coords.y.max += coords.y.minAbs
coords.z.max += coords.z.minAbs
# Convert to ratio of max
for own nodeRef of output.nodes
  node = output.nodes[nodeRef]
  node.x = node.x/coords.x.max
  node.y = node.y/coords.y.max
  node.z = node.z/coords.z.max


# Write to file
fs.writeFileSync './universe_pretty.json', JSON.stringify(output, undefined, 2)

# Report time taken
console.timeEnd 'doneAfter'
# Report status
console.log 'Done processing map data.'

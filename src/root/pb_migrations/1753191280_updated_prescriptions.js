/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_220866482")

  // update collection data
  unmarshal({
    "deleteRule": "@request.auth.id = \"\"",
    "updateRule": "@request.auth.id = \"\""
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_220866482")

  // update collection data
  unmarshal({
    "deleteRule": "@request.auth.id = doctor.id",
    "updateRule": "@request.auth.id = doctor.id"
  }, collection)

  return app.save(collection)
})

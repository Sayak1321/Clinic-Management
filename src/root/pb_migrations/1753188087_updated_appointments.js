/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1037645436")

  // update collection data
  unmarshal({
    "listRule": "\t@request.auth.id != \"\"",
    "viewRule": "\t@request.auth.id != \"\""
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1037645436")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id = patient.id",
    "viewRule": "@request.auth.id = patient.id"
  }, collection)

  return app.save(collection)
})

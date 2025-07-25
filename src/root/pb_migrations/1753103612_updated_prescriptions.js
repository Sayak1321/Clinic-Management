/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_220866482")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id = doctor.id",
    "deleteRule": "@request.auth.id = doctor.id",
    "listRule": "@request.auth.id = patient.id",
    "updateRule": "@request.auth.id = doctor.id",
    "viewRule": "@request.auth.id = patient.id"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_220866482")

  // update collection data
  unmarshal({
    "createRule": null,
    "deleteRule": null,
    "listRule": null,
    "updateRule": null,
    "viewRule": null
  }, collection)

  return app.save(collection)
})

'use strict'

const defer = require('p-defer')
const Components = require('.')
const { NotStartedError, AlreadyInitializedError } = require('../../errors')

module.exports = ({
  apiManager,
  constructorOptions,
  bitswap,
  blockService,
  gcLock,
  initOptions,
  ipld,
  ipns,
  keychain,
  libp2p,
  peerInfo,
  pinManager,
  preload,
  print,
  repo
}) => async function stop () {
  const stopPromise = defer()
  const { cancel } = apiManager.update({ stop: () => stopPromise.promise })

  try {
    blockService.unsetExchange()
    bitswap.stop()
    preload.stop()

    await Promise.all([
      ipns.republisher.stop(),
      // mfsPreload.stop(),
      libp2p.stop(),
      repo.close()
    ])

    const api = createApi({
      apiManager,
      constructorOptions,
      blockService,
      gcLock,
      initOptions,
      ipld,
      keychain,
      peerInfo,
      pinManager,
      preload,
      print,
      repo
    })

    apiManager.update(api, () => { throw new NotStartedError() })
  } catch (err) {
    cancel()
    stopPromise.reject(err)
    throw err
  }

  stopPromise.resolve(apiManager.api)
  return apiManager.api
}

function createApi ({
  apiManager,
  constructorOptions,
  blockService,
  gcLock,
  initOptions,
  ipld,
  keychain,
  peerInfo,
  pinManager,
  preload,
  print,
  repo
}) {
  const dag = Components.legacy.dag({ _ipld: ipld, _preload: preload })
  const object = Components.legacy.object({ _ipld: ipld, _preload: preload, dag, _gcLock: gcLock })
  const pin = Components.legacy.pin({ _ipld: ipld, _preload: preload, object, _repo: repo, _pinManager: pinManager })
  const add = Components.add({ ipld, dag, preload, pin, gcLock, constructorOptions })

  const start = Components.start({
    apiManager,
    constructorOptions,
    blockService,
    gcLock,
    initOptions,
    ipld,
    keychain,
    peerInfo,
    pinManager,
    preload,
    print,
    repo
  })

  const api = {
    add,
    init: () => { throw new AlreadyInitializedError() },
    start,
    stop: () => apiManager.api
  }

  return api
}
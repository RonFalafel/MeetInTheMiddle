import { start } from './serve.ts'

const PORT = Number(process.env.PORT ?? 8081)

const server = await start(PORT)
console.log(`sync server listening on :${server.port}`)

const shutdown = () => {
  void server.close().then(() => process.exit(0))
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

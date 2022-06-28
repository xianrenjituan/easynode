const Koa = require('koa')
const compose = require('koa-compose') // 组合中间件，简化写法
const http = require('http')
const https = require('https')
const { clientPort } = require('./config')
const { domain, httpPort, httpsPort, certificate } = require('./config')
const middlewares = require('./middlewares')
const wsMonitorOsInfo = require('./socket/monitor')
const wsTerminal = require('./socket/terminal')
const wsHostStatus = require('./socket/host-status')
const wsClientInfo = require('./socket/clients')
const { throwError } = require('./utils')

const httpServer = () => {
  // if(EXEC_ENV === 'production') return console.log('========生成环境不创建http服务========')
  const app = new Koa()
  const server = http.createServer(app.callback())
  serverHandler(app, server)
  // ws一直报跨域的错误：参照官方文档使用createServer API创建服务
  server.listen(httpPort, () => {
    console.log(`Server(http) is running on: http://localhost:${ httpPort }`)
  })
}

const httpsServer = () => {
  if(!certificate) return console.log('未上传证书, 创建https服务失败')
  const app = new Koa()
  const server = https.createServer(certificate, app.callback())
  serverHandler(app, server)
  server.listen(httpsPort, (err) => {
    if (err) return console.log('https server error: ', err)
    console.log(`Server(https) is running: https://${ domain }:${ httpsPort }`)
  })
}

const clientHttpServer = () => {
  const app = new Koa()
  const server = http.createServer(app.callback())
  wsMonitorOsInfo(server) // 监控本机信息
  server.listen(clientPort, () => {
    console.log(`Client(http) is running on: http://localhost:${ clientPort }`)
  })
}

// 服务
function serverHandler(app, server) {
  app.proxy = true // 用于nginx反代时获取真实客户端ip
  wsTerminal(server) // 终端
  wsHostStatus(server) // 终端侧边栏host信息
  wsClientInfo(server) // 客户端信息
  app.context.throwError = throwError // 常用方法挂载全局ctx上
  app.use(compose(middlewares))
  // 捕获error.js模块抛出的服务错误
  app.on('error', (err, ctx) => {
    ctx.status = 500
    ctx.body = {
      status: ctx.status,
      message: `Program Error：${ err.message }`
    }
  })
}

module.exports = {
  httpServer,
  httpsServer,
  clientHttpServer
}
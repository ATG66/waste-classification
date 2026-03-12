# AI 垃圾识别与回收指导网站

这是一个可直接部署到公网的轻量全栈网站，包含两种 AI 能力：

- 图片识别：上传或拍摄垃圾图片，由 AI 判断垃圾类别并给出回收建议
- 文字咨询：输入“这是什么垃圾”等问题，由 AI 返回分类与处理方式

## 已支持的公网部署能力

- 服务默认监听 `0.0.0.0`，适合云主机、容器和托管平台
- 提供 `GET /healthz` 健康检查接口
- 支持托管平台常用的 `PORT` 环境变量
- 增加了基础限流，避免公开访问后被频繁刷接口
- 提供 `Dockerfile`，可以部署到任意支持 Docker 的平台

## 本地运行

1. 在 PowerShell 中设置 API Key：

```powershell
$env:OPENAI_API_KEY="你的 OpenAI API Key"
```

2. 启动项目：

```powershell
npm start
```

3. 打开：

```text
http://localhost:3000
```

## 公网部署

最简单的方式是：

1. 把项目推到 GitHub
2. 在 Render 中导入这个仓库
3. 在 Render 中配置 `OPENAI_API_KEY`
4. 等待部署完成并获得公开网址

项目根目录已经提供 [render.yaml](./render.yaml)，Render 导入仓库后可以直接读取这份蓝图配置。

### 方式一：GitHub + Render

Render 导入仓库后，会自动使用以下配置：

- Web Service
- Node runtime
- `npm install`
- `npm start`
- 健康检查路径 `/healthz`

你只需要在 Render 后台补上 `OPENAI_API_KEY` 的真实值。

### 方式二：部署到自己的 Linux 服务器

如果你有公网服务器，可以直接这样运行：

```bash
docker build -t ai-recycling-guide .
docker run -d \
  -p 80:3000 \
  -e OPENAI_API_KEY=你的OpenAIKey \
  -e OPENAI_MODEL=gpt-4.1-mini \
  --name ai-recycling-guide \
  ai-recycling-guide
```

部署后，别人访问你的服务器域名或公网 IP 就能打开网站。

## 重要说明

- 想让“所有人都能访问”，必须把它部署到有公网地址的服务器或托管平台，单纯 `localhost` 不行
- 如果要让浏览器相机在公网环境正常工作，网站必须使用 `HTTPS`
- `OPENAI_API_KEY` 必须只放在后端环境变量里，不能写进前端代码

## 环境变量

可以参考 [`.env.example`](./.env.example)：

- `OPENAI_API_KEY`：必填
- `OPENAI_MODEL`：可选，默认 `gpt-4.1-mini`
- `HOST`：默认 `0.0.0.0`
- `PORT`：默认 `3000`
- `RATE_LIMIT_WINDOW_MS`：限流时间窗口，默认 `60000`
- `RATE_LIMIT_MAX_REQUESTS`：单个 IP 在时间窗口内的最大请求数，默认 `20`

## 项目结构

- `server.js`：后端服务、AI 接口转发、健康检查、限流
- `public/index.html`：页面结构
- `public/styles.css`：页面样式
- `public/app.js`：前端交互、相机调用、图片与文字请求
- `Dockerfile`：容器部署入口
- `render.yaml`：Render 公网部署蓝图

## 下一步建议

- 给站点绑定域名并启用 HTTPS
- 增加登录或验证码，进一步降低恶意刷接口风险
- 如果后续用户量变大，可以把限流、日志和缓存接入专业服务

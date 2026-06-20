# 发布 @injpass/cli SDK 到 npm

> 适用对象：`packages/injpass-connector/`（npm 包名 `@injpass/cli`，即「inj-cli」嵌入 SDK）。
> 何时需要：dApp（如 inj-gift）要在 **Vercel 等独立环境**安装这个 SDK 时。本地开发用 `file:` 相对依赖即可，无需发包；一旦目标项目不在同一仓库目录下（Vercel 只 clone dApp 一个仓库），`file:../inj-pass-frontend/...` 路径不存在，`install` 会失败——这时必须发到 npm（或私有 registry）。

---

## 1. 包是怎么打的（先搞清产物）

`packages/injpass-connector/package.json` 关键字段：

```jsonc
{
  "name": "@injpass/cli",          // scoped 包，首发需 --access public
  "version": "2.4.0",              // 当前版本（已含 EVM tx 能力）
  "main": "dist/index.js",         // CJS
  "module": "dist/index.mjs",      // ESM
  "types": "dist/index.d.ts",      // 类型
  "files": ["dist"],               // 只有 dist 会被发布
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "prepublishOnly": "npm run build"   // publish 前自动重新 build
  }
}
```

- **只发 `dist/`**：`files:["dist"]` + `.npmignore`（排除 `src`、`*.ts`，但保留 `*.d.ts`）共同保证源码不外泄、最终包里只有编译产物。
- `prepublishOnly` 会在 `npm publish` 前自动跑一次 `build`，所以 dist 总是最新——但**仍建议手动 build + dry-run 检查**（见下）。
- 根目录**不是** pnpm workspace（没有 `pnpm-workspace.yaml`、根 `package.json` 无 `workspaces` 字段）。所以发布命令要 **在包目录内执行**，不能在前端根目录。

---

## 2. 前置准备（只做一次）

1. **npm 账号**：https://www.npmjs.com 注册 / 登录。
2. **`@injpass` scope 归属**：`@injpass/cli` 是带 scope 的包名，scope 必须属于你的账号或你所在的 npm org，否则 publish 会 403。
   - 个人账号：scope 用你的用户名时天然可用；要用 `@injpass` 这个组织名，需在 npm 上**创建名为 `injpass` 的 organization**（free org 即可发公开包）。
   - 确认你对该 scope 有发布权限。
3. **本地登录**：
   ```bash
   npm login          # 走浏览器/OTP
   npm whoami         # 确认已登录
   ```
   CI 环境用 token 方式，见第 6 节。

---

## 3. 推荐先给 package.json 加 publishConfig（避免每次都漏 --access）

scoped 包默认发布为 **private**，个人 free 账号发 private 会报 `402 Payment Required`。两种解法二选一：

**A. 一次性写进 package.json（推荐）** —— 之后直接 `npm publish` 即可：
```jsonc
{
  "name": "@injpass/cli",
  "publishConfig": {
    "access": "public"
  }
}
```

**B. 每次发布手动带参数**：`npm publish --access public`

> 本文档示例统一用方案 B 写全 `--access public`，即使没加 `publishConfig` 也能发成功。

---

## 4. 发布步骤

全程在包目录内操作：

```bash
cd /Users/ivy/Desktop/program/injective/INJ_Pass/inj-pass-frontend/packages/injpass-connector
```

### 4.1 升版本号（遵循 semver）

```bash
# 改了行为但向后兼容 → minor；只修 bug → patch；破坏性变更 → major
npm version patch     # 2.4.0 → 2.4.1
# 或 npm version minor / npm version major
```

`npm version` 会自动改 `package.json` 的 `version` 并打一个 git tag（若在 git 仓库内）。
也可以手动改 `version` 字段。**注意：同一个版本号在 npm 上只能发一次，发过就不能覆盖**，重发必须升号。

### 4.2 构建并检查产物

```bash
npm run build                 # 重新生成 dist/（cjs + esm + d.ts）
npm pack --dry-run            # 不真正发布，列出将被打包进 tarball 的文件
```

`--dry-run` 输出里应**只看到 `dist/*` 和 package.json/README**，不应出现 `src/`、`*.ts`（除 `.d.ts`）。若看到源码，检查 `.npmignore` 和 `files` 字段。

### 4.3 发布

```bash
npm publish --access public
```

成功后到 https://www.npmjs.com/package/@injpass/cli 应能看到新版本。

### 4.4 验证

```bash
npm view @injpass/cli version          # 远端最新版本号
npm view @injpass/cli dist.tarball     # 产物地址
```

---

## 5. 发布后：把 inj-gift 依赖从 file: 切到版本号

inj-gift 目前是本地相对依赖（无法在 Vercel 安装）：

```jsonc
// inj-gift/package.json （当前）
"@injpass/cli": "file:../inj-pass-frontend/packages/injpass-connector"
```

发布后改成版本号依赖：

```jsonc
// inj-gift/package.json （发布后）
"@injpass/cli": "^2.4.1"
```

然后：

```bash
cd /Users/ivy/Desktop/program/injective/INJ_Pass/inj-gift
pnpm install          # 重新解析为 npm 上的版本
pnpm typecheck && pnpm test
```

这样 inj-gift 在 Vercel 上 `pnpm install` 才能从 npm 拉到 SDK。

> 本地继续开发若想边改 SDK 边联调，可保留 `file:` 依赖在本地，**只在准备部署的分支上切版本号**；或用 `pnpm link` / `overrides`。不要把 `file:` 依赖提交到要部署到 Vercel 的分支。

---

## 6. CI / 无人值守发布（token 方式）

CI 里不能交互 `npm login`，用 **Automation token**：

1. npm 网站 → Access Tokens → Generate New Token → **Automation**（绕过 2FA）。
2. CI 环境写入 `.npmrc`（**不要提交到仓库**）：
   ```
   //registry.npmjs.org/:_authToken=${NPM_TOKEN}
   ```
   把 `NPM_TOKEN` 放进 CI secrets。
3. 发布步骤同第 4 节。

---

## 7. 不想发公网时的替代方案

| 方案 | 适用 | 做法 |
|---|---|---|
| **GitHub Packages** | 只想内部分发 | `.npmrc` 指向 `npm.pkg.github.com`，包名 scope 用 GitHub org；`publishConfig.registry` 指定 |
| **私有 registry**（Verdaccio 等） | 团队内网 | 改 registry 地址即可，命令同上 |
| **保持 monorepo / file: 依赖** | inj-gift 和 inj-pass 放进同一个仓库一起部署 | Vercel Root Directory 设为 monorepo，相对路径成立，无需发包 |

> 若选「monorepo 一起部署」，就不需要本文档的 npm 发布流程，但要在 Vercel 配置里让 build 能访问到 `packages/injpass-connector`（pnpm workspace 或显式 `installCommand`）。

---

## 8. 版本说明

- **2.4.1**（待发）：修复 embed 页面 postMessage 解构崩溃（`const { type, data } = event.data` → `data` 为 undefined 导致 TX_RESPONSE 无法转发）；新增 `DEFAULT_CHAIN_VIEM` 统一网络配置。
- **2.4.0**：新增 EVM 交易签名能力（`signer.sendTransaction` + `getEthereumProvider()` 的 `eth_sendTransaction` 分支），用于红包等需要发交易的 dApp。详见 `docs/`（根目录）的 tx 集成总结与本包 `README.md`。
- **≤2.3.x**：仅连接 + `signMessage`（Omisper / xmtp.chat 路径）。

---

## 9. 常见错误排查

| 报错 | 原因 | 解决 |
|---|---|---|
| `402 Payment Required` | scoped 包默认 private，free 账号发 private | 加 `--access public` 或 `publishConfig.access: public` |
| `403 Forbidden` / `you do not have permission` | `@injpass` scope 不属于你/你的 org | 在 npm 创建 `injpass` org 或换成你有权限的 scope |
| `ENEEDAUTH` / `need auth` | 未登录 | `npm login`（CI 用 token） |
| `cannot publish over previously published version` | 版本号已存在 | `npm version patch` 升号后重发 |
| 包里混进了 `src/`、`.ts` 源码 | `files` / `.npmignore` 配置问题 | 用 `npm pack --dry-run` 核对，修 `.npmignore` |
| inj-gift 在 Vercel `install` 失败找不到 `@injpass/cli` | 还是 `file:` 依赖 | 切成版本号依赖（第 5 节）并先发布 |

---

## 10. 发布前 Checklist

- [ ] `dist/` 已用最新 `src/` 重新 build（`npm run build`）
- [ ] 版本号已升（`npm version`），未与线上重复
- [ ] `npm pack --dry-run` 确认只发 `dist/` + README + package.json
- [ ] 已 `npm login` / 配好 token，`npm whoami` 正常
- [ ] `@injpass` scope 有发布权限
- [ ] `npm publish --access public` 成功，`npm view @injpass/cli version` 显示新版
- [ ] inj-gift（及其它消费方）依赖从 `file:` 切到 `^<新版本>`，`install` + `typecheck` + `test` 通过
- [ ] README / 本文档版本说明已同步

---

## 11. 快速迭代命令参考

> 每次改完 SDK 代码后，一条命令走完全流程。

```bash
# ── 1. 进入包目录 ──
cd /Users/ivy/Desktop/program/injective/INJ_Pass/inj-pass-frontend/packages/injpass-connector

# ── 2. 升版本号 ──
npm version patch          # 2.4.0 → 2.4.1（修 bug）
# npm version minor       # 2.4.0 → 2.5.0（新增功能，向后兼容）
# npm version major       # 2.4.0 → 3.0.0（破坏性变更）

# ── 3. 构建 + 检查产物 ──
npm run build              # 生成 dist/
npm pack --dry-run         # 确认只发 dist/，不泄露 src/

# ── 4. 发布 ──
npm publish --access public

# ── 5. 验证远端版本 ──
npm view @injpass/cli version
```

**消费方更新（如 inj-gift）：**
```bash
cd /Users/ivy/Desktop/program/injective/INJ_Pass/inj-gift

# 改 package.json 中 @injpass/cli 版本号
# "@injpass/cli": "^2.4.1"

pnpm install               # 拉取新版
pnpm typecheck             # 验证类型
```

**本地联调（不发 npm）：**
```bash
# inj-gift 保持 file: 依赖即可
"@injpass/cli": "file:../inj-pass-frontend/packages/injpass-connector"

# 改完 SDK 代码后在 inj-pass-frontend 根目录
cd /Users/ivy/Desktop/program/injective/INJ_Pass/inj-pass-frontend
cd packages/injpass-connector && npm run build
# inj-gift 自动拿到最新产物，无需发包
```

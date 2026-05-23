# Cat NFT（NFT.Storage + baseURI）版本设计

## 1. 目标与边界

本版本只做架构落地，不改前端 mint/展示交互习惯：

- 图片与 metadata 统一上传到 NFT.Storage（IPFS）
- 合约使用固定 `baseURI = ipfs://<CID>/`
- 后端只负责两件事：**上传资产**、**owner 管理**
- 前端继续按原方式 mint，并通过 `tokenURI` 展示 NFT

> 约束：`baseURI` 固定 CID 的方案天然更适合「预生成 metadata 的固定集合」。

---

## 2. 总体架构（职责划分）

### 前端（inj-pass-frontend）
- 保持现有 mint 按钮、钱包签名、交易提交流程
- mint 时只与合约交互（不直接上传 IPFS）
- 展示时继续走 `tokenURI -> metadata -> image`

### 后端（inj-pass-backend）
- 上传图片和 metadata 到 NFT.Storage
- 产出并记录 `collectionCID`
- 维护 owner/admin 权限（谁可以触发上传、谁可以设置 baseURI）
- 提供只读接口给前端查询当前激活 CID（可选）

### 合约
- 提供 `setBaseURI(string)`（onlyOwner）
- `tokenURI(tokenId)` 返回 `baseURI + tokenId + ".json"`（或你当前实现的拼接规则）
- mint 逻辑保持前端现有调用方式

---

## 3. 数据组织规范（关键）

为保证 `baseURI = ipfs://<CID>/` 可直接寻址，metadata 目录建议：

```text
ipfs://<CID>/
  1.json
  2.json
  3.json
  ...
```

每个 metadata 中：

- `image` 使用不可变地址：`ipfs://<imageCID>`（或 `ipfs://<imagesDirCID>/<fileName>`）
- `name/description/attributes` 按 ERC-721 metadata 标准

这样合约 `tokenURI(1)` 即 `ipfs://<CID>/1.json`，前端无需改展示逻辑。

---

## 4. 推荐业务流程

1. **后端准备素材**：整理图片与 tokenId 对应关系  
2. **后端上传**：
   - 上传图片（单文件 CID 或目录 CID）
   - 生成 `N.json` metadata
   - 批量上传 metadata 目录，得到 `collectionCID`
3. **owner 设置链上配置**：
   - 调用合约 `setBaseURI("ipfs://<collectionCID>/")`
4. **前端正常 mint**：
   - 用户发起 mint 交易
   - 合约铸造 tokenId
5. **前端正常展示**：
   - 读取 `tokenURI(tokenId)`，拉取 metadata 与图片

---

## 5. 后端 API（最小化）

仅建议保留以下能力：

- `POST /admin/nft/upload-collection`
  - 输入：图片 + token 配置
  - 输出：`collectionCID`, `baseURI`
- `POST /admin/nft/set-base-uri`（可选，若后端代 owner 发交易）
  - 输入：`baseURI`
  - 输出：交易哈希
- `GET /nft/config`
  - 输出：当前 `baseURI`, `collectionCID`, 版本号（可选）

鉴权建议：仅 owner/admin 可调用 admin 接口（JWT + role + address 白名单）。

---

## 6. 风险与约束

1. **固定 CID 不可增量追加 metadata**  
   若 mint 期间还会新增 token，需重新上传目录并更新 baseURI（会影响历史 token URI 解析路径）。

2. **tokenId 与 metadata 文件名必须严格一致**  
   否则前端可 mint 成功但展示失败。

3. **网关可用性问题**  
   前端展示建议保留 IPFS 网关回退策略（你现有 `ipfs:// -> gateway` 逻辑可继续使用）。

---

## 7. 建议上线顺序

1. 后端完成上传脚本与 owner 鉴权  
2. 测试网上传一批样例并设置 baseURI  
3. 前端仅做配置切换（合约地址/baseURI 来源）并回归 mint + 展示  
4. 主网执行同流程

---

## 8. 版本结论

这个版本可以做到：

- 资产托管统一到 NFT.Storage
- 合约只维护一个固定 `baseURI`
- 后端职责清晰（上传 + owner 管理）
- 前端 mint/展示流程保持不变

符合你提出的「先定方案、暂不改业务交互」目标。

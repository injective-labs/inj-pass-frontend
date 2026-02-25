# Pumex Swap 集成 - 配置清单

## 📋 配置前检查

- [ ] 你已阅读 `PUMEX_QUICKSTART.md`
- [ ] 你已了解如何查找 Pumex Router 地址
- [ ] 你的 Node.js 版本 >= 18
- [ ] 你已安装 pnpm

## 🔍 查找 Router 地址

### 方式 1: 通过 Pumex dApp
- [ ] 打开 Pumex Web 应用
- [ ] 打开浏览器开发者工具 (F12)
- [ ] 切换到 Network 标签
- [ ] 执行一次 swap 操作
- [ ] 在 Network 中找到 `eth_sendTransaction` 请求
- [ ] 复制请求中的 `to` 字段
- [ ] **Router 地址**: `0x________________`

### 方式 2: 询问官方
- [ ] 查看 Pumex GitBook 文档
- [ ] 在 Pumex 社区频道询问
- [ ] 查看 GitHub 仓库（如果有）

### 方式 3: 区块浏览器
- [ ] 访问 https://blockscout.injective.network/
- [ ] 搜索 "Pumex" 或 "Router"
- [ ] 找到已验证的 Router 合约
- [ ] 复制合约地址

## ⚙️ 配置步骤

### 1. 安装依赖
```bash
cd frontend
pnpm install
```
- [ ] 依赖安装成功
- [ ] 确认安装了 `tsx` 包

### 2. 配置 Router 地址
- [ ] 打开文件: `frontend/src/services/dex-swap.ts`
- [ ] 找到第 30 行左右
- [ ] 将 `ROUTER_ADDRESS` 的值改为你的 Router 地址
- [ ] 保存文件

**示例**:
```typescript
// 修改前
export const ROUTER_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

// 修改后（示例地址）
export const ROUTER_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678' as Address;
```

### 3. 验证配置（可选但推荐）
```bash
# 编辑 scripts/find-router.ts，将 POTENTIAL_ROUTER_ADDRESS 改为你的地址
pnpm find-router
```
- [ ] 脚本运行成功
- [ ] 显示 "✅ This IS a contract"
- [ ] 显示 "✅ Successfully got quote"

## 🧪 测试功能

### 1. 启动开发服务器
```bash
pnpm dev
```
- [ ] 服务器启动在 http://localhost:3000
- [ ] 没有编译错误

### 2. 访问 Swap 页面
- [ ] 打开 http://localhost:3000/swap
- [ ] 页面正常加载
- [ ] 可以看到 INJ, USDT, USDC 三个 token

### 3. 解锁钱包
- [ ] 点击解锁钱包
- [ ] 使用 Passkey 完成认证
- [ ] 钱包成功解锁

### 4. 检查余额显示
- [ ] INJ 余额正确显示
- [ ] USDT 余额正确显示（如果有）
- [ ] USDC 余额正确显示（如果有）

### 5. 测试报价功能
- [ ] 选择 From: INJ
- [ ] 选择 To: USDT
- [ ] 输入金额: 0.01
- [ ] 等待 1-2 秒
- [ ] 预估输出自动显示
- [ ] 没有错误提示

### 6. 执行 Swap（小额测试）
- [ ] 输入金额: 0.01 INJ
- [ ] 确认预估输出合理
- [ ] 点击 "Swap Tokens"
- [ ] 等待交易确认
- [ ] 看到成功提示
- [ ] 显示交易哈希

### 7. 验证交易
- [ ] 复制交易哈希
- [ ] 访问 https://blockscout.injective.network/
- [ ] 粘贴哈希查看详情
- [ ] 交易状态为 Success

### 8. 测试其他交易对
**INJ → USDC**
- [ ] 报价正常
- [ ] Swap 成功

**USDT → USDC**
- [ ] 报价正常
- [ ] 授权自动处理
- [ ] Swap 成功

**USDC → USDT**
- [ ] 报价正常
- [ ] Swap 成功

## 🐛 问题排查

### 如果报价失败
- [ ] 检查浏览器控制台错误
- [ ] 确认 Router 地址配置正确
- [ ] 运行 `pnpm find-router` 验证
- [ ] 确认该交易对有流动性

### 如果 Swap 失败
- [ ] 检查余额是否充足
- [ ] 确认有足够的 INJ 支付 gas
- [ ] 查看错误信息
- [ ] 尝试增加滑点（改为 1%）

### 如果授权失败
- [ ] 等待前一个授权交易完成
- [ ] 刷新页面重试
- [ ] 检查钱包是否解锁

## ✅ 生产部署前

### 代码检查
- [ ] 所有功能在 testnet 测试通过
- [ ] 没有 console 错误
- [ ] 性能表现良好

### 安全检查
- [ ] Router 地址已验证
- [ ] Token 地址已核对
- [ ] 滑点设置合理（建议 0.5-1%）

### 用户体验
- [ ] 加载状态清晰
- [ ] 错误提示友好
- [ ] 交易流程顺畅

### 文档
- [ ] 团队成员了解如何使用
- [ ] 准备用户指南（如需要）

## 📝 配置记录

**日期**: ___________

**Router 地址**: `0x________________`

**验证方式**: 
- [ ] dApp 查找
- [ ] 官方文档
- [ ] 区块浏览器
- [ ] 社区确认

**测试结果**:
- INJ → USDT: ✅ / ❌
- INJ → USDC: ✅ / ❌
- USDT → USDC: ✅ / ❌

**部署环境**:
- [ ] Testnet
- [ ] Mainnet

**备注**: 
_________________________________
_________________________________

## 🎉 完成！

当所有复选框都被勾选时，你的 Pumex Swap 集成就完全配置好了！

需要帮助？查看:
- `PUMEX_QUICKSTART.md` - 快速开始
- `PUMEX_INTEGRATION.md` - 详细文档
- `INTEGRATION_SUMMARY.md` - 技术总结

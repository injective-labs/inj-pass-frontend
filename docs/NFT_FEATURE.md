# N1NJ4 NFT Integration

## 概述

已成功集成 N1NJ4 NFT 的真实数据显示功能。现在 Dashboard 的 NFTs 标签页会从 Injective EVM 链上获取真实的 N1NJ4 NFT 数据，而不是显示 mock 数据。

## 智能合约信息

- **合约名称**: N1NJ4
- **合约地址**: `0x816070929010a3d202d8a6b89f92bee33b7e8769`
- **链**: Injective EVM Mainnet (Chain ID: 1776)
- **合约类型**: ERC-721

## 新增功能

### 1. NFT 服务 (`src/services/nft.ts`)

创建了完整的 NFT 服务，包含以下功能：

- **获取 NFT 余额**: `getNFTBalance(contractAddress, ownerAddress)`
- **获取用户的所有 NFT**: `getUserNFTs(contractAddress, ownerAddress)`
- **获取 NFT 详细信息**: `getNFTDetails(contractAddress, tokenId)`
- **获取 N1NJ4 NFT**: `getN1NJ4NFTs(ownerAddress)` - 便捷方法
- **获取集合信息**: `getCollectionInfo(contractAddress)`
- **元数据解析**: 自动从 IPFS 和其他来源获取 NFT 元数据

### 2. NFT 详情模态框 (`src/components/NFTDetailModal.tsx`)

创建了一个美观的垂直卡片式 NFT 详情模态框，显示：

- NFT 图片
- NFT 名称和描述
- Token ID
- 合约地址
- NFT 属性/特征（如果有）
- 外部链接（如果有）
- Blockscout 浏览器链接

### 3. Dashboard 更新

更新了 Dashboard 页面 (`app/dashboard/page.tsx`)：

- 集成 NFT 服务
- 当用户切换到 NFTs 标签时自动加载 NFT 数据
- 显示加载状态
- 点击 NFT 卡片打开详情模态框
- 空状态提示（当用户没有 NFT 时）

## 使用方法

### 查看 NFT

1. 启动开发服务器：
   ```bash
   npm run dev
   ```

2. 登录到钱包

3. 在 Dashboard 页面，点击 "NFTs" 标签

4. 系统会自动加载该地址在 Injective EVM 上持有的所有 N1NJ4 NFT

5. 点击任意 NFT 卡片查看详细信息

### 详情模态框功能

- **查看图片**: 完整显示 NFT 图片
- **复制地址**: 点击复制按钮复制合约地址
- **查看属性**: 显示所有 NFT 属性和特征
- **外部链接**: 如果有 external_url，可以访问外部网站
- **浏览器链接**: 在 Blockscout 上查看 NFT 详情

## 技术实现

### NFT 数据获取流程

1. 用户切换到 NFTs 标签
2. 调用 `getN1NJ4NFTs(address)` 获取该地址的所有 N1NJ4 NFT
3. 服务首先调用合约的 `balanceOf` 方法获取 NFT 数量
4. 然后通过 `tokenOfOwnerByIndex` 获取每个 token ID
5. 对每个 token ID 调用 `tokenURI` 获取元数据 URI
6. 从 URI 获取元数据（支持 IPFS 和 HTTP）
7. 解析元数据，提取名称、描述、图片、属性等信息
8. 返回完整的 NFT 对象数组

### IPFS 支持

服务自动处理 IPFS URI：
- `ipfs://QmXXX...` 会被转换为 `https://ipfs.io/ipfs/QmXXX...`
- 支持元数据和图片的 IPFS 链接

### 性能优化

- 批量处理：每次处理 5 个 NFT，避免 API 速率限制
- 并行请求：使用 Promise.all 并行获取多个 NFT 数据
- 懒加载：只在用户切换到 NFTs 标签时才加载数据
- 缓存：已加载的 NFT 数据会保留在状态中

## API 端点

服务使用以下 RPC 端点：
- **主网 RPC**: `https://sentry.evm-rpc.injective.network/`
- **浏览器**: `https://blockscout.injective.network`

## 扩展其他 NFT 集合

如果需要支持其他 NFT 集合，只需：

1. 在 `src/services/nft.ts` 中添加新的合约地址常量：
   ```typescript
   export const YOUR_NFT_CONTRACT = '0xYourContractAddress' as Address;
   ```

2. 创建便捷方法（可选）：
   ```typescript
   export async function getYourNFTs(ownerAddress: Address): Promise<NFT[]> {
     return getUserNFTs(YOUR_NFT_CONTRACT, ownerAddress);
   }
   ```

3. 在 Dashboard 中调用新方法获取数据

## 故障排除

### NFT 未显示

1. 确认地址确实持有 N1NJ4 NFT
2. 检查浏览器控制台的错误信息
3. 验证 RPC 端点可访问
4. 检查合约地址是否正确

### 图片无法加载

1. 检查元数据中的图片 URL 是否有效
2. 如果是 IPFS 链接，确保 IPFS 网关可访问
3. 查看浏览器控制台的网络请求错误

### 加载缓慢

1. NFT 数量多时加载会较慢（因为需要获取每个 NFT 的元数据）
2. 批量处理大小可以在 `getUserNFTs` 函数中调整
3. 考虑添加进度指示器

## 未来改进

- [ ] 添加 NFT 缓存到 localStorage
- [ ] 支持更多 NFT 集合
- [ ] NFT 转账功能
- [ ] NFT 交易历史
- [ ] NFT 价格信息
- [ ] 筛选和排序功能
- [ ] NFT 画廊视图
- [ ] 支持 ERC-1155 多版本 NFT

## 相关文件

- `src/services/nft.ts` - NFT 服务核心逻辑
- `src/components/NFTDetailModal.tsx` - NFT 详情模态框组件
- `app/dashboard/page.tsx` - Dashboard 页面（已更新）
- `src/types/chain.ts` - 链配置

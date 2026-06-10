import { useState } from 'react'
import DataImport from './DataImport'
import DataCenter from './DataCenter'

export default function DataManagement({ user, orders, onImported, onRefresh, onOpenRules }) {
  const [activeTab, setActiveTab] = useState('import')

  return (
    <div className="dashboard-view">
      <div className="tab-bar">
        {[
          ['import', '数据导入'],
          ['center', '数据中心'],
          ['rules', '分类规则'],
        ].map(([key, label]) => (
          <button key={key} className={`tab-pill ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'import' && <DataImport onImported={onImported} />}
      {activeTab === 'center' && <DataCenter user={user} orders={orders} onRefresh={onRefresh} />}
      {activeTab === 'rules' && (
        <div className="chart-card wide">
          <div className="chart-title">人工分类 / 品类归并</div>
          <p className="modal-desc">
            用于把颜色、材质、内页、规格等细分款式归并到经营一级品类。规则保存后可应用到已有订单，也会影响后续导入。
          </p>
          <div className="rules-guide-grid">
            <div className="rules-guide-item">
              <strong>精确 SKU</strong>
              <span>适合指定某一个 SKU 必须归入某个品类。</span>
            </div>
            <div className="rules-guide-item">
              <strong>关键词包含</strong>
              <span>适合把 wood、内页、钱包等关键词统一归类。</span>
            </div>
            <div className="rules-guide-item">
              <strong>应用到已有订单</strong>
              <span>把历史数据重新清洗，让看板口径立刻统一。</span>
            </div>
          </div>
          <button className="btn-primary-sm" onClick={onOpenRules}>打开分类规则</button>
        </div>
      )}
    </div>
  )
}

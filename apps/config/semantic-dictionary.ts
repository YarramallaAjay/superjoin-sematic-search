const semanticDictionary = {
  "metrics": {
    "Revenue": ["sales", "turnover", "topline", "gross income", "income", "revenue", "sales revenue", "total sales", "gross revenue", "net sales", "operating revenue"],
    "Gross Profit": ["gross margin", "gp", "gross profit", "gross income", "gross earnings", "gross profit margin", "gross profit %"],
    "Net Profit": ["net income", "bottom line", "profit after tax", "np", "net profit", "pat", "net earnings", "net profit margin", "net income margin", "final profit"],
    "Operating Profit": ["ebit", "ebitda", "operating income", "operating profit", "operating earnings", "operating margin", "operating profit margin", "operating income margin"],
    "Cost of Goods Sold": ["cogs", "direct costs", "production costs", "cost of sales", "cost of revenue", "direct expenses", "manufacturing costs", "product costs"],
    "Expenses": ["opex", "operating expenses", "selling costs", "administrative expenses", "overhead", "operating costs", "business expenses", "running costs", "operational expenses"],
    "Cash Flow": ["cf", "net cash", "cash inflow", "cash outflow", "operating cash flow", "cash flow from operations", "free cash flow", "cash generation", "cash position"],
    "Margin": ["profit margin", "operating margin", "net margin", "gross margin", "margin %", "profitability", "margin ratio", "profit ratio"],
    "Growth": ["yoy", "qoq", "growth rate", "increase", "change %", "growth", "growth %", "year over year", "quarter over quarter", "periodic growth", "expansion"],
    "Forecast": ["projection", "estimate", "budget", "forecast", "planned", "expected", "target", "outlook", "prediction", "planning"],
    "EBITDA": ["ebitda", "earnings before interest tax depreciation amortization", "ebitda margin", "ebitda %", "operating ebitda"],
    "EBIT": ["ebit", "earnings before interest and tax", "operating profit", "operating earnings", "operating income"],
    "Depreciation": ["depreciation", "dep", "amortization", "depreciation expense", "amortization expense", "capital depreciation"],
    "Interest": ["interest expense", "interest", "finance cost", "interest cost", "borrowing cost", "debt interest"],
    "Tax": ["tax expense", "tax", "income tax", "corporate tax", "taxation", "tax burden", "effective tax rate"],
    "Assets": ["total assets", "asset base", "capital assets", "fixed assets", "current assets", "asset value"],
    "Liabilities": ["total liabilities", "debt", "obligations", "payables", "current liabilities", "long term debt"],
    "Equity": ["shareholders equity", "book value", "net worth", "equity value", "owner equity"],
    "ROI": ["return on investment", "roi", "investment return", "return %", "investment yield"],
    "ROE": ["return on equity", "roe", "equity return", "shareholder return", "equity yield"],
    "ROA": ["return on assets", "roa", "asset return", "asset yield", "asset efficiency"]
  },
  "dimensions": {
    "Customer": ["client", "account", "customer id", "buyer", "customer", "customer name", "end user", "purchaser", "consumer", "user"],
    "Region": ["geography", "location", "area", "region", "territory", "zone", "country", "state", "city", "market", "geographic"],
    "Product": ["product", "item", "sku", "product name", "service", "offering", "solution", "commodity", "goods", "merchandise"],
    "Department": ["dept", "department", "division", "unit", "team", "function", "business unit", "cost center", "profit center"],
    "Channel": ["channel", "sales channel", "distribution", "route to market", "sales route", "distribution channel", "sales method", "delivery method"],
    "Category": ["category", "segment", "classification", "type", "group", "class", "tier", "level", "bucket", "segment"],
    "Industry": ["industry", "sector", "business sector", "market sector", "vertical", "business vertical", "industry vertical"],
    "Company": ["company", "organization", "firm", "enterprise", "business", "corporation", "entity", "establishment"],
    "Brand": ["brand", "brand name", "trademark", "product brand", "company brand", "brand identity"],
    "Market": ["market", "marketplace", "business market", "target market", "market segment", "market area"]
  },
  "time": {
    "Year": ["fy", "financial year", "year", "calendar year", "annual", "yearly", "fiscal year", "business year", "reporting year"],
    "Quarter": ["q1", "q2", "q3", "q4", "quarter", "quarterly", "three months", "3 month period", "quarter period", "fiscal quarter"],
    "Month": ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "month", "monthly", "30 day period", "calendar month"],
    "Period": ["period", "timeframe", "duration", "span", "interval", "cycle", "term", "phase"],
    "Date": ["date", "specific date", "point in time", "moment", "timestamp", "day", "week", "bi-weekly"]
  },
  "status": {
    "Open": ["open", "active", "pending", "in progress", "ongoing", "current", "live", "running", "active status"],
    "Closed": ["closed", "completed", "resolved", "finished", "done", "finalized", "concluded", "terminated", "ended"],
    "Cancelled": ["cancelled", "cancelled", "abandoned", "terminated", "stopped", "discontinued", "halted", "suspended", "voided"]
  },
  "priority": {
    "High": ["high", "critical", "urgent", "priority 1", "top priority", "immediate", "essential", "vital", "crucial"],
    "Medium": ["medium", "normal", "standard", "priority 2", "moderate", "average", "regular", "typical", "usual"],
    "Low": ["low", "minor", "low priority", "priority 3", "minimal", "insignificant", "trivial", "non-critical", "optional"]
  },
      "operations": {
      "Sales": ["sales", "selling", "revenue generation", "business development", "sales operations", "sales process"],
      "Marketing": ["marketing", "advertising", "promotion", "brand awareness", "lead generation", "market development"],
      "Finance": ["finance", "financial", "accounting", "treasury", "financial management", "financial planning"],
      "Operations": ["operations", "operational", "business operations", "day to day", "operational efficiency", "process management"],
      "HR": ["hr", "human resources", "personnel", "staffing", "recruitment", "employee management", "workforce", "complaints", "hr complaints", "employee complaints"],
      "IT": ["it", "information technology", "tech", "technology", "systems", "digital", "automation", "software"]
    },
  "performance": {
    "Efficiency": ["efficiency", "productivity", "performance", "effectiveness", "optimization", "streamlining", "improvement"],
    "Quality": ["quality", "standards", "excellence", "reliability", "consistency", "accuracy", "precision"],
    "Speed": ["speed", "velocity", "pace", "rate", "timeliness", "response time", "processing time"],
    "Cost": ["cost", "expense", "expenditure", "spending", "investment", "budget", "financial impact"],
    "Volume": ["volume", "quantity", "amount", "scale", "magnitude", "size", "capacity", "throughput"]
  }
}

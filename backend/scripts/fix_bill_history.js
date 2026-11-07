import fs from 'fs';

const filePath = 'c:/Users/shaik/Desktop/fishes_1/fish_website/frontend/src/components/admin/billing/BillHistory.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace the Order Type td to include the Sales Type td right before it
const target = `{t(bill.billType || 'Takeaway')}`;
const tdStart = content.lastIndexOf('<td className="px-3 py-2.5 whitespace-nowrap">', content.indexOf(target));

if (tdStart !== -1) {
  const insertion = `                      {/* td 4: Sales Type */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {getSalesTypeBadge(bill)}
                      </td>
                      {/* td 5: Order Type */}
`;
  content = content.slice(0, tdStart) + insertion + content.slice(tdStart);
  
  // Also fix colSpan="8" to colSpan="9"
  content = content.replace('colSpan="8"', 'colSpan="9"');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated BillHistory.jsx with Sales Type column and colSpan 9!');
} else {
  console.error('Could not locate target in BillHistory.jsx');
}


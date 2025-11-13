import jsPDF from 'jspdf';
import {
  CampaignReportResponse,
  CampaignReportsOverview,
  CampaignReportSummary,
} from '@/services/api';

const formatNumber = (value: number) => value.toLocaleString();
const formatPercentage = (value: number) => `${value.toFixed(2)}%`;

const downloadBlob = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportCampaignReportToCSV = (report: CampaignReportResponse, filename = 'campaign-report.csv') => {
  const rows = [
    ['Campaign', report.campaignName],
    ['Campaign ID', report.campaignId],
    ['Total Messages', report.total],
    ['Delivered', report.delivered],
    ['Failed', report.failed],
    ['Read', report.read],
    ['Read Count', report.readCount],
    ['Delivery Rate', `${report.deliveryRate}%`],
    ['Failure Rate', `${report.failureRate}%`],
    ['Created At', report.createdAt],
    ['Last Updated', report.lastUpdated],
  ];

  const csvContent = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadBlob(csvContent, filename, 'text/csv;charset=utf-8;');
};

export const exportOverviewToCSV = (
  overview: CampaignReportsOverview,
  filename = 'campaign-overview.csv',
) => {
  const header = ['Campaign ID', 'Campaign Name', 'Total', 'Delivered', 'Failed', 'Read', 'Delivery Rate', 'Failure Rate', 'Last Updated'];

  const campaignRows = overview.campaigns.map((campaign: CampaignReportSummary) => [
    campaign.campaignId,
    campaign.campaignName,
    campaign.total,
    campaign.delivered,
    campaign.failed,
    campaign.read,
    `${campaign.deliveryRate}%`,
    `${campaign.failureRate}%`,
    campaign.lastUpdated,
  ]);

  const totalsRow = ['Totals', '', overview.totals.total, overview.totals.delivered, overview.totals.failed, overview.totals.read, `${overview.totals.deliveryRate}%`, `${overview.totals.failureRate}%`, ''];

  const csvContent = [header, ...campaignRows, totalsRow]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  downloadBlob(csvContent, filename, 'text/csv;charset=utf-8;');
};

export const exportCampaignReportToPDF = (
  report: CampaignReportResponse,
  filename = 'campaign-report.pdf',
) => {
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(16);
  doc.text(`Campaign Report: ${report.campaignName}`, 14, y);
  y += 10;

  doc.setFontSize(12);
  const rows: [string, string | number][] = [
    ['Campaign ID', report.campaignId],
    ['Total Messages', formatNumber(report.total)],
    ['Delivered', formatNumber(report.delivered)],
    ['Failed', formatNumber(report.failed)],
    ['Read', formatNumber(report.read)],
    ['Read Count', formatNumber(report.readCount)],
    ['Delivery Rate', formatPercentage(report.deliveryRate)],
    ['Failure Rate', formatPercentage(report.failureRate)],
    ['Created At', report.createdAt],
    ['Last Updated', report.lastUpdated],
  ];

  rows.forEach(([label, value]) => {
    doc.text(`${label}: ${value}`, 14, y);
    y += 8;
  });

  doc.save(filename);
};

export const exportOverviewToPDF = (
  overview: CampaignReportsOverview,
  filename = 'campaign-overview.pdf',
) => {
  const doc = new jsPDF({ orientation: 'landscape' });
  let y = 20;

  doc.setFontSize(16);
  doc.text('Campaign Reports Overview', 14, y);
  y += 10;

  doc.setFontSize(12);
  doc.text(
    `Totals - Sent: ${formatNumber(overview.totals.total)} | Delivered: ${formatNumber(overview.totals.delivered)} | Failed: ${formatNumber(overview.totals.failed)} | Read: ${formatNumber(overview.totals.read)} | Delivery Rate: ${formatPercentage(
      overview.totals.deliveryRate,
    )} | Failure Rate: ${formatPercentage(overview.totals.failureRate)}`,
    14,
    y,
  );
  y += 12;

  doc.setFontSize(11);
  overview.campaigns.forEach((campaign, index) => {
    if (y > 190) {
      doc.addPage();
      y = 20;
    }

    doc.text(
      `${index + 1}. ${campaign.campaignName} (ID: ${campaign.campaignId}) - Total: ${formatNumber(
        campaign.total,
      )}, Delivered: ${formatNumber(campaign.delivered)}, Failed: ${formatNumber(campaign.failed)}, Read: ${formatNumber(campaign.read)}, Delivery Rate: ${formatPercentage(
        campaign.deliveryRate,
      )}, Failure Rate: ${formatPercentage(campaign.failureRate)}, Updated: ${campaign.lastUpdated}`,
      14,
      y,
    );
    y += 8;
  });

  doc.save(filename);
};

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trpc } from '@/lib/trpc/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

const formSchema = z.object({
  file: z.instanceof(File).refine((file) => file.type === 'text/csv' || file.name.endsWith('.csv'), {
    message: 'File must be a CSV file'
  })
});

type FormValues = z.infer<typeof formSchema>;

type RateCardSummary = {
  code: string;
  name: string;
  unit: string;
  bands: number;
};

type PreviewData = {
  rows: unknown[];
  summary: RateCardSummary[];
};

export function ImportPageClient() {
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(formSchema)
  });

  const previewMutation = trpc.imports.preview.useMutation({
    onSuccess: (data) => {
      setPreviewData(data);
      toast.success(`Preview ready: ${data.summary.length} rate cards found`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to preview CSV');
    }
  });

  const executeMutation = trpc.imports.execute.useMutation({
    onSuccess: (data) => {
      toast.success(`Successfully imported ${data.imported} rate card(s)`);
      reset();
      setCsvContent(null);
      setFileName('');
      setPreviewData(null);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to import rate cards');
    }
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      setPreviewData(null); // Reset preview when new file selected
    };
    reader.readAsText(file);
  };

  const handlePreview = () => {
    if (!csvContent) {
      toast.error('Please select a CSV file first');
      return;
    }

    previewMutation.mutate({ csv: csvContent });
  };

  const handleImport = () => {
    if (!csvContent || !previewData) {
      toast.error('Please preview the CSV first');
      return;
    }

    executeMutation.mutate({
      csv: csvContent,
      fileName: fileName || `rate-card-${Date.now()}.csv`
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Import Rate Cards</h1>
        <p className="mt-2 text-sm text-slate-600">
          Upload a CSV file to import rate cards and pricing bands. The file will be validated before import.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload CSV File</CardTitle>
          <CardDescription>
            CSV format: code, name, unit, fromQty, toQty, pricePerThousand, makeReadyFixed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit(() => {})} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="csv-file" className="block text-sm font-medium text-slate-700">
                Select CSV File
              </label>
              <div className="flex items-center gap-4">
                <input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  {...register('file')}
                  onChange={(e) => {
                    register('file').onChange(e);
                    handleFileChange(e);
                  }}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand file:text-white hover:file:bg-brand-muted cursor-pointer"
                />
              </div>
              {errors.file && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.file.message}
                </p>
              )}
            </div>

            {csvContent && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handlePreview}
                  disabled={previewMutation.isPending}
                  variant="secondary"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {previewMutation.isPending ? 'Previewing...' : 'Preview CSV'}
                </Button>
              </div>
            )}
          </form>

          {previewData && (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">Preview Ready</span>
                </div>
                <p className="mt-2 text-sm text-green-700">
                  Found {previewData.summary.length} rate card(s) with {previewData.rows.length} total pricing band(s)
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="font-semibold text-slate-900">Rate Cards Summary</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700">Unit</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-700">Bands</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {previewData.summary.map((item) => (
                        <tr key={item.code}>
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.code}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{item.name}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{item.unit}</td>
                          <td className="px-4 py-3 text-right text-sm text-slate-600">{item.bands}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleImport}
                  disabled={executeMutation.isPending}
                  className="bg-brand hover:bg-brand-muted"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {executeMutation.isPending ? 'Importing...' : 'Import Rate Cards'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CSV Format Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-slate-600">
            <p>The CSV file must include the following columns:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>code</strong>: Rate card identifier (e.g., &quot;LIT-001&quot;)</li>
              <li><strong>name</strong>: Operation description (e.g., &quot;Litho Printing&quot;)</li>
              <li><strong>unit</strong>: Pricing unit type - must be one of: &quot;per_1k&quot;, &quot;job&quot;, or &quot;enclose&quot;</li>
              <li><strong>fromQty</strong>: Band start quantity (integer)</li>
              <li><strong>toQty</strong>: Band end quantity (integer)</li>
              <li><strong>pricePerThousand</strong>: Unit price per thousand</li>
              <li><strong>makeReadyFixed</strong>: Fixed make-ready cost</li>
            </ul>
            <p className="mt-4 pt-4 border-t border-slate-200">
              <strong>Note:</strong> Multiple rows with the same code will be grouped into one rate card with multiple pricing bands.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


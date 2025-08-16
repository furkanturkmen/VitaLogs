// src/components/upload/HealthUpload.js
import { useState } from 'react';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import supabase from '../../lib/supabaseClient';

export default function HealthUpload({ user }) {
  const [status, setStatus] = useState('No file uploaded yet');

  // Tune these safely:
  const BATCH_SIZE = 5000;   // insert 5k rows per batch
  const LIMIT_FOR_TEST = 0;  // set e.g. 2000 to limit during testing (0 = no limit)

  // Expand any time:
  const allowedTypes = [
    // Quantity
    'HKQuantityTypeIdentifierStepCount',
    'HKQuantityTypeIdentifierHeartRate',
    'HKQuantityTypeIdentifierDistanceWalkingRunning',
    'HKQuantityTypeIdentifierActiveEnergyBurned',
    'HKQuantityTypeIdentifierBodyMass',
    'HKQuantityTypeIdentifierDietaryWater',
    'HKQuantityTypeIdentifierBloodGlucose',
    // Category
    'HKCategoryTypeIdentifierSleepAnalysis',
    'HKCategoryTypeIdentifierMindfulSession',
  ];

  const handleUpload = async (file) => {
    if (!file) return;
    setStatus('Processing file…');

    try {
      const zip = await JSZip.loadAsync(file);

      // Dynamically locate export.xml
      const exportXmlPath = Object.keys(zip.files).find((p) =>
        p.toLowerCase().endsWith('export.xml')
      );
      if (!exportXmlPath) {
        setStatus('❌ export.xml not found in ZIP file.');
        return;
      }

      const xmlString = await zip.file(exportXmlPath)?.async('string');

      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(xmlString);

      const records = parsed?.HealthData?.Record ?? [];
      // Filter for the types we want first
      let filtered = records.filter((r) => allowedTypes.includes(r['@_type']));

      // Optional test limit to avoid freezing with huge exports
      if (LIMIT_FOR_TEST > 0) filtered = filtered.slice(0, LIMIT_FOR_TEST);

      if (filtered.length === 0) {
        setStatus('❌ No matching health records found for the selected types.');
        return;
      }

      // Map to DB rows
      const rows = filtered.map((r) => ({
        user_id: user.id,
        type: r['@_type'],
        value: parseFloat(r['@_value']) || 0, // category types may have no numeric value
        unit: r['@_unit'] || '',
        start_time: r['@_startDate'],
        end_time: r['@_endDate'],
      }));

      // Chunked inserts to keep browser responsive and avoid payload limits
      let inserted = 0;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE);

        const { error } = await supabase.from('health_data').insert(chunk);
        if (error) {
          setStatus(`❌ Upload failed on batch ${i / BATCH_SIZE + 1}: ${error.message}`);
          return;
        }

        inserted += chunk.length;
        setStatus(`Uploading… ${inserted} / ${rows.length}`);
        // Yield to the UI event loop between batches:
        await new Promise((r) => setTimeout(r, 0));
      }

      setStatus(`✅ Uploaded ${inserted} health records`);
    } catch (err) {
      console.error(err);
      setStatus('❌ Error processing file');
    }
  };

  return (
    <div>
      <h2>Upload Health Export</h2>
      <input
        type="file"
        accept=".zip"
        onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
      />
      <p>{status}</p>
    </div>
  );
}

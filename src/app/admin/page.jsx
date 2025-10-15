'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { storage } from '@/lib/storage';
import AdminGuard from '@/components/admin/AdminGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Check, X, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';

const ADMIN_ADDRESS = '0x42C31Db2d6B12D5CD81e23d33eab7Abf49188E35';

export default function AdminPage() {
  return (
    <AdminGuard adminAddress={ADMIN_ADDRESS}>
      <Dashboard />
    </AdminGuard>
  );
}

function Dashboard() {
  const { address: reviewer } = useAccount();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // 'pending' | 'approved' | 'rejected' | 'all'

  useEffect(() => {
    (async () => {
      setLoading(true);
      const list = await storage.listProfiles();
      setProfiles(Array.isArray(list) ? list : []);
      setLoading(false);
    })();
  }, []);

  // Flatten verifications into table rows
  const rows = useMemo(() => {
    return profiles.flatMap((p) =>
      (p.roleBadges || []).map((rb) => ({
        address: p.address,
        displayName: p.displayName,
        role: rb.role,
        verification: rb.verification || {},
        idImage: rb.verification?.idImage, // { name, dataUrl, ... }
      }))
    );
  }, [profiles]);

  const filtered = rows.filter((r) =>
    filter === 'all' ? true : (r.verification.status || 'pending') === filter
  );

  const refresh = async () => {
    const list = await storage.listProfiles();
    setProfiles(Array.isArray(list) ? list : []);
  };

  const setStatus = async (row, status) => {
    await storage.updateVerification({
      address: row.address,
      role: row.role,
      status, // 'approved' | 'rejected'
      reviewer,
    });
    await refresh();
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-600">Review role verifications and documents.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
         
            <h1 className='dark:text-white'>Submissions</h1>
          
          <div className="flex items-center gap-2">
            {['pending', 'approved', 'rejected', 'all'].map((k) => (
              <Button
                key={k}
                size="sm"
                variant={filter === k ? 'default' : 'outline'}
                onClick={() => setFilter(k)}
              >
                {k[0].toUpperCase() + k.slice(1)}
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No submissions.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 dark:border-gray-800">
                <tr className="text-gray-600">
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Address</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Method</th>
                  <th className="py-2 pr-4">Evidence</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const s = r.verification.status || 'pending';
                  const method = r.verification.method || '-';
                  const addrShort = r.address
                    ? `${r.address.slice(0, 6)}…${r.address.slice(-4)}`
                    : '-';

                  return (
                    <tr key={i} className="border-b last:border-0 border-gray-100 dark:border-gray-800">
                      <td className="py-3 pr-4 font-medium">{r.displayName || '(no name)'}</td>
                      <td className="py-3 pr-4 font-mono">{addrShort}</td>
                      <td className="py-3 pr-4">{r.role}</td>
                      <td className="py-3 pr-4 uppercase text-xs">{method}</td>
                      <td className="py-3 pr-4">
                        {method === 'linkedin' && r.verification.linkedinUrl && (
                          <Link
                            href={r.verification.linkedinUrl}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <ExternalLink className="h-4 w-4" />
                            LinkedIn
                          </Link>
                        )}
                        {(method === 'student_id' || method === 'prc_id') && r.idImage?.dataUrl && (
                          <a
                            href={r.idImage.dataUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <ImageIcon className="h-4 w-4" />
                            View ID
                          </a>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={
                            s === 'approved'
                              ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700'
                              : s === 'rejected'
                              ? 'rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700'
                              : 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700'
                          }
                        >
                          {s}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => setStatus(r, 'approved')}
                          >
                            <Check className="mr-1 h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setStatus(r, 'rejected')}
                          >
                            <X className="mr-1 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

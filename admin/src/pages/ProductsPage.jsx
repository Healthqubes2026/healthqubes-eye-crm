import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { productsAPI, salesAPI, meetingsAPI } from '../api';
import { PageLoader, EmptyState, Modal, Badge } from '../components/common';
import { fmtINR, apiError, fmtDate } from '../utils/helpers';
import { useForm, useFieldArray } from 'react-hook-form';
import toast from 'react-hot-toast';

const UNITS = ['piece', 'box', 'vial', 'bottle', 'pack', 'kit', 'pair', 'strip'];

function SaleForm({ product, onClose, onSave, doctors = [] }) {
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm({
    defaultValues: { 
      items: [{ product_id: product.id, quantity: 1 }],
      sale_date: new Date().toISOString().split('T')[0],
      payment_mode: 'cash',
      doctor_id: '',
      hospital: '',
      notes: ''
    },
  });
  const { fields, remove } = useFieldArray({ control, name: 'items' });
  const watchItems = watch('items');
  const orderTotal = watchItems.reduce((sum, item) => {
    return sum + (parseFloat(product.unit_price) * (parseInt(item.quantity) || 0));
  }, 0);

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="bg-blue-50 rounded-lg p-3 mb-2">
        <p className="text-xs text-blue-700"><span className="font-medium">{product.name}</span> — {fmtINR(product.unit_price)} per {product.unit}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-surface-700 mb-1">Doctor (Optional)</label>
          <select {...register('doctor_id')} className="select">
            <option value="">Select doctor...</option>
            {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-700 mb-1">Sale Date</label>
          <input type="date" {...register('sale_date')} className="input" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-surface-700 mb-1">Hospital / Clinic</label>
          <input {...register('hospital')} className="input" placeholder="Hospital or clinic name" />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-700 mb-1">Payment Mode</label>
          <select {...register('payment_mode')} className="select">
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="neft">NEFT</option>
            <option value="cheque">Cheque</option>
            <option value="credit">Credit</option>
          </select>
        </div>
      </div>

      {/* Quantity */}
      <div>
        <label className="text-xs font-medium text-surface-700">Quantity</label>
        <div className="flex gap-2 items-center mt-1">
          <input type="number" min="1" {...register('items.0.quantity')} className="input text-center" placeholder="Qty" />
          <span className="text-xs text-surface-500">{product.unit}</span>
        </div>
      </div>

      {/* Order total */}
      {orderTotal > 0 && (
        <div className="bg-emerald-50 rounded-lg px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-emerald-700 font-medium">Total</span>
          <span className="text-lg font-semibold text-emerald-700">{fmtINR(orderTotal)}</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-surface-700 mb-1">Notes</label>
        <textarea {...register('notes')} rows={2} className="input resize-none" placeholder="Optional notes..." />
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary">Record Sale</button>
      </div>
    </form>
  );
}


function ProductForm({ product, onClose, onSave, treatmentCategories = [] }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: product || { name: '', category: '', unit_price: '', unit: 'piece', is_active: true, treatment_category_id: '', hospital: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-surface-700 mb-1">Product Name *</label>
          <input {...register('name', { required: 'Name is required' })}
            className="input" placeholder="e.g. Cataract IOL Lens (Monofocal)" />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-700 mb-1">Category</label>
          <input {...register('category')} className="input" placeholder="e.g. Lens, Injection, Drops" />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-700 mb-1">Unit</label>
          <select {...register('unit')} className="select">
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-surface-700 mb-1">Treatment Category</label>
          <select {...register('treatment_category_id')} className="select">
            <option value="">-- Select Treatment Category --</option>
            {treatmentCategories.map(tc => (
              <option key={tc.id} value={tc.id}>{tc.name}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-surface-700 mb-1">Hospital (Optional)</label>
          <input {...register('hospital')} className="input" placeholder="e.g. Apollo Eye Hospital Delhi" />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-700 mb-1">Unit Price (₹) *</label>
          <input type="number" step="0.01" min="0"
            {...register('unit_price', { required: 'Price is required', min: { value: 0, message: 'Price must be positive' } })}
            className="input" placeholder="0.00" />
          {errors.unit_price && <p className="text-xs text-red-500 mt-1">{errors.unit_price.message}</p>}
        </div>
        {product && (
          <div className="flex items-center gap-2 pt-5">
            <input type="checkbox" id="is_active" {...register('is_active')} className="w-4 h-4 accent-brand-500" />
            <label htmlFor="is_active" className="text-sm text-surface-700">Active</label>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary">{product ? 'Save Changes' : 'Add Product'}</button>
      </div>
    </form>
  );
}

export default function ProductsPage() {
  const qc = useQueryClient();
  const [addModal, setAddModal]     = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [deleteProduct, setDeleteProduct] = useState(null);
  const [saleProduct, setSaleProduct] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterTreatmentId, setFilterTreatmentId] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const { data, isLoading } = useQuery(
    ['products', showInactive],
    () => productsAPI.list({ active: showInactive ? 'all' : '1' }).then(r => r.data.data),
    { staleTime: 30000 }
  );

  const { data: categories } = useQuery(
    'product-categories',
    () => productsAPI.categories().then(r => r.data.data)
  );

  const { data: treatmentCategories } = useQuery(
    'treatment-categories',
    () => productsAPI.treatmentCategories().then(r => r.data.data)
  );

  const { data: doctorsData } = useQuery(
    'doctors-for-sale',
    () => meetingsAPI.listDoctors({ limit: 100 }).then(r => r.data.data),
    { staleTime: 60000 }
  );

  const addMutation = useMutation(
    (vals) => productsAPI.add(vals),
    {
      onSuccess: () => { toast.success('Product added'); qc.invalidateQueries('products'); qc.invalidateQueries('product-categories'); setAddModal(false); },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const editMutation = useMutation(
    (vals) => productsAPI.update(editProduct.id, { ...vals, is_active: vals.is_active ? 1 : 0 }),
    {
      onSuccess: () => { toast.success('Product updated'); qc.invalidateQueries('products'); setEditProduct(null); },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const deleteMutation = useMutation(
    (id) => productsAPI.remove(id),
    {
      onSuccess: (_, id) => {
        toast.success('Product removed');
        qc.invalidateQueries('products');
        setDeleteProduct(null);
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const saleMutation = useMutation(
    (formData) => {
      const { items, ...saleData } = formData;
      return salesAPI.add({
        ...saleData,
        items: items.map(item => ({ product_id: item.product_id, quantity: item.quantity }))
      });
    },
    {
      onSuccess: () => {
        toast.success('Sale recorded successfully');
        qc.invalidateQueries('products');
        qc.invalidateQueries('sales-list');
        qc.invalidateQueries('sales-summary');
        setSaleProduct(null);
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const products = (data || []).filter(p => {
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterTreatmentId && p.treatment_category_id !== parseInt(filterTreatmentId)) return false;
    return true;
  });

  // Group by treatment category if filter is set, otherwise by product category
  const grouped = products.reduce((acc, p) => {
    const groupKey = filterTreatmentId && p.treatment_category_name 
      ? p.treatment_category_name 
      : (p.category || 'Uncategorized');
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="text-sm text-surface-500 mt-0.5">Manage product catalogue for sales</p>
        </div>
        <button onClick={() => setAddModal(true)} className="btn-primary">+ Add Product</button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="select w-48">
          <option value="">All Categories</option>
          {(categories || []).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterTreatmentId} onChange={e => setFilterTreatmentId(e.target.value)} className="select w-56">
          <option value="">All Treatment Categories</option>
          {(treatmentCategories || []).map(tc => (
            <option key={tc.id} value={tc.id}>{tc.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-surface-600 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
            className="w-4 h-4 accent-brand-500" />
          Show inactive
        </label>
        <span className="text-xs text-surface-400 ml-auto">{products.length} product{products.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Products */}
      {isLoading ? (
        <PageLoader />
      ) : products.length === 0 ? (
        <EmptyState icon="📦" title="No products yet" description="Add your first product to get started" />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-surface-100 bg-surface-50">
                <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-widest">{category}</h3>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Treatment Category</th>
                    <th>Hospital</th>
                    <th>Unit</th>
                    <th>Unit Price</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(p => (
                    <tr key={p.id} className={!p.is_active ? 'opacity-50' : ''}>
                      <td className="font-medium text-sm text-surface-900">{p.name}</td>
                      <td className="text-xs text-surface-600">{p.treatment_category_name || '—'}</td>
                      <td className="text-xs text-surface-600">{p.hospital || '—'}</td>
                      <td className="text-xs text-surface-500 capitalize">{p.unit || 'piece'}</td>
                      <td className="font-semibold text-emerald-700">{fmtINR(p.unit_price)}</td>
                      <td>
                        {p.is_active
                          ? <Badge variant="green">Active</Badge>
                          : <Badge variant="gray">Inactive</Badge>}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSaleProduct(p)}
                            className="text-xs text-emerald-500 hover:text-emerald-700 font-medium px-2 py-1 rounded hover:bg-emerald-50 transition-colors">
                            💰 Sale
                          </button>
                          <button
                            onClick={() => setEditProduct(p)}
                            className="text-xs text-brand-500 hover:text-brand-700 font-medium px-2 py-1 rounded hover:bg-brand-50 transition-colors">
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteProduct(p)}
                            className="text-xs text-red-400 hover:text-red-600 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Product" width="max-w-lg">
        <ProductForm onClose={() => setAddModal(false)} onSave={(v) => addMutation.mutate(v)} treatmentCategories={treatmentCategories} />
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editProduct} onClose={() => setEditProduct(null)} title="Edit Product" width="max-w-lg">
        {editProduct && (
          <ProductForm
            product={editProduct}
            onClose={() => setEditProduct(null)}
            onSave={(v) => editMutation.mutate(v)}
            treatmentCategories={treatmentCategories}
          />
        )}
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteProduct} onClose={() => setDeleteProduct(null)} title="Remove Product" width="max-w-sm">
        {deleteProduct && (
          <div className="space-y-4">
            <p className="text-sm text-surface-700">
              Are you sure you want to remove <span className="font-semibold">{deleteProduct.name}</span>?
              If it has sales history, it will be deactivated instead of deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteProduct(null)} className="btn-secondary">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(deleteProduct.id)}
                disabled={deleteMutation.isLoading}
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50">
                {deleteMutation.isLoading ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Sale Modal */}
      <Modal open={!!saleProduct} onClose={() => setSaleProduct(null)} title={`Record Sale - ${saleProduct?.name}`} width="max-w-md">
        {saleProduct && (
          <SaleForm
            product={saleProduct}
            onClose={() => setSaleProduct(null)}
            onSave={(v) => saleMutation.mutate(v)}
            doctors={doctorsData || []}
          />
        )}
      </Modal>
    </div>
  );
}

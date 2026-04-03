// @ts-nocheck

import { useState } from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { X, Search, Calendar, MapPin, Trash2, Minus, Plus } from 'lucide-react';

interface ReservationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventName?: string;
  eventDate?: string;
  eventLocation?: string;
}

export function ReservationModal({ 
  open, 
  onOpenChange,
  eventName = "Annual Tech Conference 2026",
  eventDate = "April 15, 2026",
  eventLocation = "San Francisco Convention Center"
}: ReservationModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<Array<{ id: string; name: string; quantity: number }>>([]);

  // Mock inventory items for demonstration
  const mockInventory = [
    'Laptop (MacBook Pro)',
    'Projector',
    'Microphone',
    'Speaker System',
    'Conference Table',
    'Chairs',
    'Whiteboard',
    'Display Monitor',
    'HDMI Cable',
    'Extension Cord'
  ];

  const filteredInventory = searchQuery
    ? mockInventory.filter(item => 
        item.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleAddItem = (itemName: string) => {
    const itemId = `${itemName}-${Date.now()}`;
    setItems([...items, { id: itemId, name: itemName, quantity: 1 }]);
    setSearchQuery('');
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
  };

  const handleIncrementQuantity = (itemId: string) => {
    setItems(items.map(item => 
      item.id === itemId ? { ...item, quantity: item.quantity + 1 } : item
    ));
  };

  const handleDecrementQuantity = (itemId: string) => {
    setItems(items.map(item => 
      item.id === itemId ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item
    ));
  };

  const handleReserve = () => {
    console.log('Reserving inventory for event:', { eventName, items });
    // Handle reservation logic here
    onOpenChange(false);
    setItems([]);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 gap-0 border-0 shadow-2xl">
        {/* Header with Event Info */}
        <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Reserve Inventory</h2>
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-gray-900">{eventName}</p>
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {eventDate}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {eventLocation}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-full p-1.5 hover:bg-white/50 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-5">
          {/* Search Inventory */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Search Inventory
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Type to search inventory items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-gray-50 border-gray-200 focus:bg-white"
              />
            </div>
            
            {/* Search Results Dropdown */}
            {searchQuery && filteredInventory.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg shadow-lg max-h-[180px] overflow-y-auto">
                {filteredInventory.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleAddItem(item)}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
            
            {searchQuery && filteredInventory.length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-500 text-center">
                No inventory items found
              </div>
            )}
          </div>

          {/* Reserved Items List */}
          {items.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Items to Reserve ({items.length})
              </label>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2 max-h-[280px] overflow-y-auto">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center bg-white px-4 py-3 rounded-md shadow-sm"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    </div>
                    
                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3 ml-4">
                      <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2 py-1">
                        <button
                          onClick={() => handleDecrementQuantity(item.id)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                        <span className="text-sm font-medium text-gray-900 w-8 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleIncrementQuantity(item.id)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                      </div>
                      
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {items.length === 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-6 text-center">
              <p className="text-sm text-blue-900 font-medium">No items added yet</p>
              <p className="text-xs text-blue-700 mt-1">Search and select inventory items to reserve for this event</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <Button
            onClick={handleReserve}
            disabled={items.length === 0}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Reserve {items.length > 0 && `${totalItems} ${totalItems === 1 ? 'Item' : 'Items'}`} for Event
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

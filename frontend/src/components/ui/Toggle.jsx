export default function Toggle({ checked, onChange, activeLabel = 'Actif', inactiveLabel = 'Inactif', size = 'md' }) {
  const dims = size === 'sm'
    ? { track: 'w-9 h-5', thumb: 'w-4 h-4', translate: 'translate-x-4' }
    : { track: 'w-11 h-6', thumb: 'w-5 h-5', translate: 'translate-x-5' };

  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        onClick={onChange}
        className={`relative ${dims.track} rounded-full transition-colors cursor-pointer ${checked ? 'bg-[#E10600]' : 'bg-gray-200'}`}
      >
        <div className={`absolute top-0.5 left-0.5 ${dims.thumb} bg-white rounded-full shadow transition-transform ${checked ? dims.translate : ''}`} />
      </div>
      <span className={`text-sm font-semibold ${checked ? 'text-[#E10600]' : 'text-gray-400'}`}>
        {checked ? activeLabel : inactiveLabel}
      </span>
    </label>
  );
}
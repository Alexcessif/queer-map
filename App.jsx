import { MapContainer, TileLayer, GeoJSON, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import L from 'leaflet';

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
}

function App() {
  const [geoData, setGeoData] = useState(null);
  const [filterLgbtq, setFilterLgbtq] = useState(false);
  const [filterPmr, setFilterPmr] = useState('all');
  
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlaceCoords, setNewPlaceCoords] = useState(null);
  

  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newAmenity, setNewAmenity] = useState('bar');
  const [newWheelchair, setNewWheelchair] = useState('yes');
  const [newLgbtq, setNewLgbtq] = useState('yes');
  

  const [wcUnisex, setWcUnisex] = useState(false);
  const [wcWheelchair, setWcWheelchair] = useState(false);
  const [wcRamp, setWcRamp] = useState(false);
  
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  const allowedAmenities = [
    'bar', 'pub', 'restaurant', 'cafe', 'fast_food', 
    'biergarten', 'centre_arts', 'cinema', 'theatre', 
    'club', 'centre_communautaire', 'librairie', 'musée'
  ];

  useEffect(() => {
    fetch('/export.geojson')
      .then((res) => res.json())
      .then((data) => {
        fetch('https://safe-mapp.onrender.com/api/places')
          .then((res) => res.json())
          .then((customPlaces) => {
            const customFeatures = customPlaces.map((p) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [p.lng, p.lat] },
              properties: p
            }));
            setGeoData({
              ...data,
              features: [...customFeatures, ...data.features]
            });
          })
          .catch(() => setGeoData(data));
      })
      .catch((err) => console.error("Erreur GeoJSON :", err));
  }, []);

  const getPmrColor = (wheelchair) => {
    switch (wheelchair) {
      case 'yes': return '#16a34a';
      case 'limited': return '#f97316';
      case 'no': return '#8b5cf6';
      default: return '#9ca3af';
    }
  };

  const pointToLayer = (feature, latlng) => {
    const wheelchair = feature.properties?.wheelchair;
    return L.circleMarker(latlng, {
      radius: 8,
      fillColor: getPmrColor(wheelchair),
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    });
  };

  const filterFeatures = (feature) => {
    const props = feature.properties || {};
    if (!allowedAmenities.includes(props.amenity)) return false;

    if (filterLgbtq) {
      const isLgbtq = props.lgbtq === 'yes' || props.lgbtq === 'primary' || props.gay === 'welcome' || props.lgbtq === 'user_added';
      if (!isLgbtq) return false;
    }

    if (filterPmr !== 'all' && props.wheelchair !== filterPmr) {
      return false;
    }

    return true;
  };

  const onEachFeature = (feature, layer) => {
    layer.on({
      click: (e) => {
        L.DomEvent.stopPropagation(e);
        setShowAddForm(false);
        setSelectedPlace(feature.properties);
      }
    });
  };

  const handleMapClick = (latlng) => {
    setSelectedPlace(null);
    setNewPlaceCoords(latlng);
    setShowAddForm(true);
    setNewAddress(`${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
  };

  const handleAddPlace = async (e) => {
    e.preventDefault();
    if (!newName) return;

    let coords = newPlaceCoords;

    if (newAddress) {
      setIsSearchingAddress(true);
      try {
        const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(newAddress)}&limit=1`);
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
          const [lon, lat] = data.features[0].geometry.coordinates;
          coords = { lat, lng: lon };
        } else if (!newPlaceCoords) {
          alert("Adresse introuvable.");
          setIsSearchingAddress(false);
          return;
        }
      } catch (error) {
        console.error("Erreur géoloc :", error);
      }
      setIsSearchingAddress(false);
    }

    const wcStatus = [
      wcUnisex ? 'unisex' : null,
      wcWheelchair ? 'wheelchair' : null,
      wcRamp ? 'ramp' : null
    ].filter(Boolean).join(',');

    const payload = {
      name: newName,
      address: newAddress,
      amenity: newAmenity,
      wheelchair: newWheelchair,
      wc: wcStatus,
      lgbtq: newLgbtq,
      lat: coords.lat,
      lng: coords.lng
    };

    try {
      const res = await fetch('https://safe-mapp.onrender.com/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const newFeature = {
          type: "Feature",
          geometry: { type: "Point", coordinates: [coords.lng, coords.lat] },
          properties: payload
        };

        setGeoData((prevData) => ({
          ...prevData,
          features: [newFeature, ...prevData.features]
        }));

        setShowAddForm(false);
        setNewName('');
        setNewAddress('');
        setWcUnisex(false);
        setWcWheelchair(false);
        setWcRamp(false);
        setNewPlaceCoords(null);
        alert("Nouveau lieu enregistré");
      }
    } catch (err) {
      alert("db.py n'est pas lancé sur le port 8000.");
    }
  };

  return (
    <div style={{ width: '100dvw', height: '100dvh', position: 'relative', display: 'flex' }}>
      
      {/* Recherche lieu existant */}
      {selectedPlace && (
        <div style={{
          width: '100%', height: '50%', backgroundColor: '#ffffff',
          boxShadow: '2px 0 10px rgba(0,0,0,0.1)', zIndex: 1001, padding: '20px',
          boxSizing: 'border-box', overflowY: 'auto', fontFamily: 'sans-serif'
        }}>
          <button onClick={() => setSelectedPlace(null)} style={{ float: 'right', border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
          <h2 style={{ marginTop: 0, fontSize: '20px', color: '#1f2937' }}>{selectedPlace.name || 'Lieu sans nom'}</h2>
          
          {selectedPlace.address && (
            <p style={{ fontSize: '13px', color: '#4b5563', margin: '5px 0' }}>📍 {selectedPlace.address}</p>
          )}

          <p style={{ textTransform: 'capitalize', color: '#6b7280', fontWeight: 'bold' }}>Type : {selectedPlace.amenity || 'Établissement'}</p>
          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '15px 0' }} />
          
          <div style={{ marginBottom: '15px' }}>
            <h4 style={{ margin: '0 0 5px 0' }}>Accessibilité PMR</h4>
            <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '4px', color: '#fff', backgroundColor: getPmrColor(selectedPlace.wheelchair), fontSize: '12px', fontWeight: 'bold' }}>
              {selectedPlace.wheelchair === 'yes' ? 'Accessible PMR' : selectedPlace.wheelchair === 'limited' ? 'Partiellement accessible' : selectedPlace.wheelchair === 'no' ? 'Non accessible' : 'Non renseigné'}
            </span>
          </div>

          {selectedPlace.wc && (
            <div style={{ marginBottom: '15px' }}>
              <h4 style={{ margin: '0 0 5px 0' }}>Toilettes</h4>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '14px', color: '#374151' }}>
                {selectedPlace.wc.includes('unisex') && <li>Toilettes mixtes</li>}
                {selectedPlace.wc.includes('wheelchair') && <li>Accessibles PMR</li>}
                {selectedPlace.wc.includes('ramp') && <li>Accès par rampe</li>}
              </ul>
            </div>
          )}

          <div style={{ marginBottom: '15px' }}>
            <h4 style={{ margin: '0 0 5px 0' }}>Repère LGBTQ+</h4>
            <p style={{ margin: 0, fontSize: '14px', color: '#374151' }}>
              {selectedPlace.lgbtq ? `Safe (${selectedPlace.lgbtq})` : 'Non renseigné'}
            </p>
          </div>
        </div>
      )}

      {/* Ajout lieu  */}
      {showAddForm && (
        <div style={{
          width: '320px', height: '100%', backgroundColor: '#ffffff',
          boxShadow: '2px 0 10px rgba(0,0,0,0.1)', zIndex: 1001, padding: '20px',
          boxSizing: 'border-box', overflowY: 'auto', fontFamily: 'sans-serif'
        }}>
          <button onClick={() => setShowAddForm(false)} style={{ float: 'right', border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
          <h2 style={{ marginTop: 0, fontSize: '18px', color: '#f43f5e' }}>Ajouter un établissement</h2>

          <form onSubmit={handleAddPlace} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Nom de l'établissement *</label>
              <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Le Kfé Safe" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Adresse postale *</label>
              <input type="text" required value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="Ex: 10 Rue d'Alsace-Lorraine, Toulouse" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Type d'établissement</label>
              <select value={newAmenity} onChange={(e) => setNewAmenity(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                <option value="bar">Bar / Pub</option>
                <option value="restaurant">Restaurant</option>
                <option value="cafe">Café</option>
                <option value="theatre">Théâtre / Lieu culturel</option>
                <option value="nightclub">Boîte de nuit</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Accessibilité PMR</label>
              <select value={newWheelchair} onChange={(e) => setNewWheelchair(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                <option value="yes">Accessible (De plain-pied)</option>
                <option value="limited">Partiellement (Rampes / Marches)</option>
                <option value="no">Non accessible</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Toilettes</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={wcUnisex} 
                    onChange={(e) => setWcUnisex(e.target.checked)} 
                  />
                  Toilettes mixtes / neutres
                </label>
                <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={wcWheelchair} 
                    onChange={(e) => setWcWheelchair(e.target.checked)} 
                  />
                  Toilettes accessibles en fauteuil (PMR)
                </label>
                <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox"
                    checked={wcRamp}
                    onChange={(e) => setWcRamp(e.target.checked)}
                  />
                  Toilettes avec une rampe
                </label>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Lieu Safe / LGBTQ+</label>
              <select value={newLgbtq} onChange={(e) => setNewLgbtq(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                <option value="yes">Oui (Revendiqué / Safe)</option>
                <option value="user_added">Oui (Ajouté par un-e utilisateur-ice)</option>
                <option value="no">Non précisé</option>
              </select>
            </div>

            <button type="submit" disabled={isSearchingAddress} style={{ padding: '10px', backgroundColor: '#e11d48', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
              {isSearchingAddress ? "Recherche de l'adresse..." : "Placer sur la carte"}
            </button>
          </form>
        </div>
      )}

      {/* Carte */}
      <div style={{ flex: 1, height: '100%', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={() => { setSelectedPlace(null); setShowAddForm(true); }} style={{ padding: '10px 15px', backgroundColor: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            + Ajouter un endroit
          </button>

          <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.2)', fontFamily: 'sans-serif', minWidth: '200px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '15px' }}>Filtres</h4>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', cursor: 'pointer', fontSize: '14px' }}>
              <input type="checkbox" checked={filterLgbtq} onChange={(e) => setFilterLgbtq(e.target.checked)} />
              <strong>Lieux Safe / LGBTQ+</strong>
            </label>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>PMR :</label>
              <select value={filterPmr} onChange={(e) => setFilterPmr(e.target.value)} style={{ width: '100%', padding: '5px', borderRadius: '4px' }}>
                <option value="all">Tous</option>
                <option value="yes">Accessible (Vert)</option>
                <option value="limited">Partiel (Orange)</option>
              </select>
            </div>
          </div>
        </div>

        <MapContainer center={[43.59982, 1.44269]} zoom={13} style={{ width: '100%', height: '100%' }}>
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClickHandler onMapClick={handleMapClick} />
          {geoData && (
            <GeoJSON 
              key={`${filterLgbtq}-${filterPmr}-${geoData.features.length}`}
              data={geoData} 
              filter={filterFeatures}
              pointToLayer={pointToLayer} 
              onEachFeature={onEachFeature} 
            />
          )}
        </MapContainer>
      </div>

    </div>
  );
}

export default App;

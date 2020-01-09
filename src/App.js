import '@reshuffle/code-transform/macro'
import React, { useEffect, useState } from 'react';

import Checkbox from '@material-ui/core/Checkbox';
import FormControlLabel from '@material-ui/core/FormControlLabel';

import {
  buildEventCatalog,
  getAllHooks,
  registerWebhook,
  removeWebhook,
} from '../backend/teamwork';

import {
  getSheetUrl,
} from '../backend/sheet';

import './styles/App.css';


// ({ name, url, id, eventId }));
const EventColumn = ({
  chunk,
  eventHasHook,
  handleCheckChange,
}) => {
  return (
    <div className='events-column'>
      <div className='events-column-wrapper'>
        {
          chunk.map(({ name, id }) =>
            <div className='event-item'>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={eventHasHook(id)}
                    onChange={(evt) => {
                      evt.preventDefault();
                      handleCheckChange(id, eventHasHook(id));
                    }}
                    value={name}
                  />
                }
                label={name}
              />
            </div>
          )
        }
      </div>
    </div>
  );
}

const EventCheck = () => {
  const [catalog, setCatalog] = useState([]);
  const [hooks, setHooks] = useState([]);
  const [isByCat, setByCat] = useState(false);
  const [sheetUrl, setSheetUrl] = useState(undefined);
  useEffect(() => {
    async function load() {
      const eventCatalog = await buildEventCatalog();
      const allHooks = await getAllHooks();
      const url = await getSheetUrl();
      setCatalog(eventCatalog);
      setHooks(allHooks);
      setSheetUrl(url);
    }
    load();
  }, []);

  const eventHasHook = (eId) => {
    return hooks.some(({ eventId }) => eventId === eId);
  };

  const handleCheckChange = async (id, currState) => {
    console.log(currState);
    if (currState) {
      await removeWebhook(id)
      const filteredHooks = hooks.filter(({ eventId }) =>
        eventId !== id);
      setHooks(filteredHooks);
    } else {
      const newHook = await registerWebhook(id);
      setHooks([...hooks, newHook]);
    }
  }

  if (!hooks || !catalog || !sheetUrl) {
    return <div className='events-control'/>
  }

  const numCols = 2;
  const perChunk = Math.ceil(catalog.length / numCols);

  const split = catalog.reduce((resultArray, item, index) => {
    const chunkIndex = Math.floor(index/perChunk)

    if(!resultArray[chunkIndex]) {
      resultArray[chunkIndex] = [] // start a new chunk
    }
    resultArray[chunkIndex].push(item)
    return resultArray
  }, [])


  return (
    <div className='events-panel'>
      <div className='events-link'>
        <div className='events-link-title'>
          View event data here:
        </div>
        <a href={sheetUrl}>
          {sheetUrl.slice(0, 50)}
        </a>
      </div>
      <div className='events-control'>
        {
          split.map((catalogChunk) =>
            <EventColumn
              chunk={catalogChunk}
              eventHasHook={eventHasHook}
              handleCheckChange={handleCheckChange}
            />
          )
        }
      </div>
    </div>
  );
};

function App() {
  return (
    <div className='App'>
      <EventCheck/>
    </div>
  );
}

export default App;

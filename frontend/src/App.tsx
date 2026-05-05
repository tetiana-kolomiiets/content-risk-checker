import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { CheckPage } from './routes/CheckPage';
import { HomePage } from './routes/HomePage';
import { NotFoundPage } from './routes/NotFoundPage';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/checks/:id" element={<CheckPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}

export default App;

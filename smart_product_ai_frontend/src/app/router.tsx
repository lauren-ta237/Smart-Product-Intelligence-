import {
    BrowserRouter,
    Routes,
    Route
} from "react-router-dom";

// 🟢 Corrected Module & Feature Relative Path Imports
import Review from "../pages/Review";
import Login from '../features/auth/login';
import Dashboard from "../pages/dashboard";
import Upload from "../features/upload/UploadDropzone";

// 🟢 Looks in the exact same folder (src/app/) for your Route guard
import ProtectedRoute from "../components/auth/ProtectedRoute";

export default function Router() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Core Workspace Hub (Requires Token Auth Guard Validation) */}
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />

                {/* Identity Management Gateway */}
                <Route
                    path="/login"
                    element={<Login />}
                />

                {/* AI Auditing Review Workspace Module */}
                <Route
                    path="/review"
                    element={<Review />}
                />

                {/* Multimodal File Upload Pipeline Ingestion Target */}
                <Route
                    path="/upload"
                    element={<Upload />}
                />
            </Routes>
        </BrowserRouter>
    );
}
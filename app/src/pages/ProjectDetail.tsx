import { Typography } from '@mui/material';
import { useParams } from 'react-router-dom';

export default function ProjectDetail() {
  const { id } = useParams();
  return <Typography variant="h5">Project detail #{id}</Typography>;
}

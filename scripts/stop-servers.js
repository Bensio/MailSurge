// Cross-platform script to stop servers on ports 3000 and 3001
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function stopServers() {
  console.log('🛑 Stopping servers on ports 3000 and 3001...\n');
  
  const isWindows = process.platform === 'win32';
  
  try {
    if (isWindows) {
      // Windows: Find and kill processes using netstat and taskkill
      const ports = [3000, 3001];
      
      for (const port of ports) {
        try {
          // Find process using the port
          const { stdout } = await execAsync(`netstat -ano | findstr :${port} | findstr LISTENING`);
          const lines = stdout.trim().split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            
            if (pid && !isNaN(pid)) {
              console.log(`   Stopping process ${pid} on port ${port}...`);
              try {
                await execAsync(`taskkill /F /PID ${pid}`);
                console.log(`   ✓ Process ${pid} stopped`);
              } catch (error) {
                // Process might already be stopped
                console.log(`   ⚠ Process ${pid} not found or already stopped`);
              }
            }
          }
        } catch (error) {
          // No process found on this port
          console.log(`   No process found on port ${port}`);
        }
      }
    } else {
      // Unix/Linux/Mac: Use lsof and kill
      const ports = [3000, 3001];
      
      for (const port of ports) {
        try {
          const { stdout } = await execAsync(`lsof -ti:${port}`);
          const pids = stdout.trim().split('\n').filter(pid => pid.trim());
          
          for (const pid of pids) {
            console.log(`   Stopping process ${pid} on port ${port}...`);
            try {
              await execAsync(`kill -9 ${pid}`);
              console.log(`   ✓ Process ${pid} stopped`);
            } catch (error) {
              console.log(`   ⚠ Process ${pid} not found or already stopped`);
            }
          }
        } catch (error) {
          console.log(`   No process found on port ${port}`);
        }
      }
    }
    
    console.log('\n✅ Servers stopped successfully!\n');
  } catch (error) {
    console.error('❌ Error stopping servers:', error.message);
    process.exit(1);
  }
}

stopServers();






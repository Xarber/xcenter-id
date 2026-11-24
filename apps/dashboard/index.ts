import { registerRootComponent } from 'expo';
import App from './src/App';
import DialogProvider from './src/DialogProvider';
import {createElement} from 'react';

registerRootComponent(()=>createElement(DialogProvider,{children:createElement(App)}));

import { useState, useEffect } from 'react';
import { View, ScrollView, Text, TextInput, Button, StyleSheet } from 'react-native';

const API_URL = 'http://192.168.1.178:3000';

export default function GroupsScreen() {
  const [groups, setGroups] = useState<any[]>([]);
  const [groupName, setGroupName] = useState('');
  const [message, setMessage] = useState('');

  const fetchGroups = async () => {
    try {
      const response = await fetch(`${API_URL}/groups`);
      const data = await response.json();
      setGroups(data);
    } catch (error) {
      setMessage(`Error fetching groups: ${error}`);
    }
  }
}